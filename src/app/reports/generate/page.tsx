'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Copy, Save, Calendar as CalendarIcon, Database } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { collection, serverTimestamp, addDoc, query, where, getDocs } from 'firebase/firestore';
import type { GeneratedReport, Breakdown, CompletedSchedule, DailyDiary } from '@/lib/types';
import { generateReport, type ReportInput } from '@/ai/flows/generate-report-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface AggregatedData {
    newBreakdowns: Breakdown[];
    closedBreakdowns: Breakdown[];
    completedSchedules: CompletedSchedule[];
    dailyDiaries: DailyDiary[];
}

export default function GenerateReportPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();

    const [isFetching, setIsFetching] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedReport, setGeneratedReport] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    });
    const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null);

    const handleFetchData = async () => {
        if (!date?.from || !date?.to) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a valid date range.' });
            return;
        }

        setIsFetching(true);
        setAggregatedData(null);
        setError(null);

        try {
            const startDate = format(date.from, 'yyyy-MM-dd');
            const endDate = format(date.to, 'yyyy-MM-dd');
            
            const startDateISO = startOfDay(date.from).toISOString();
            const endDateISO = endOfDay(date.to).toISOString();

            const newBreakdownsQuery = query(
                collection(firestore, 'breakdown_reports'),
                where('date', '>=', startDate),
                where('date', '<=', endDate)
            );
            
            const closedBreakdownsQuery = query(
                collection(firestore, 'breakdown_reports'),
                where('resolved', '==', true),
                where('timeBackInService', '>=', startDateISO),
                where('timeBackInService', '<=', endDateISO)
            );

            const schedulesQuery = query(
                collection(firestore, 'completed_schedules'),
                where('completionDate', '>=', startDate),
                where('completionDate', '<=', endDate)
            );
            
            const diariesQuery = query(
                collection(firestore, 'daily_diaries'),
                where('date', '>=', startDate),
                where('date', '<=', endDate)
            );

            const [newBreakdownsSnap, closedBreakdownsSnap, schedulesSnap, diariesSnap] = await Promise.all([
                getDocs(newBreakdownsQuery),
                getDocs(closedBreakdownsQuery),
                getDocs(schedulesQuery),
                getDocs(diariesQuery),
            ]);

            const fetchedData: AggregatedData = {
                newBreakdowns: newBreakdownsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Breakdown)),
                closedBreakdowns: closedBreakdownsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Breakdown)),
                completedSchedules: schedulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompletedSchedule)),
                dailyDiaries: diariesSnap.docs.map(doc => {
                    const data = doc.data();
                    // Firestore Timestamps are not serializable for Server Actions.
                    // We must convert them to a primitive type like a string before passing them.
                    if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                        data.createdAt = data.createdAt.toDate().toISOString();
                    }
                    return { id: doc.id, ...data } as DailyDiary;
                }),
            };

            setAggregatedData(fetchedData);
            toast({ title: 'Data Fetched', description: 'Summary is displayed below. You can now generate the report.' });

        } catch (e: any) {
            console.error(e);
            setError('Failed to fetch data from the database. Please check your connection and try again.');
            toast({ variant: 'destructive', title: 'Data Fetching Failed', description: e.message || 'An unknown error occurred.' });
        } finally {
            setIsFetching(false);
        }
    };


    const handleGenerateReport = async () => {
        if (!date?.from || !date?.to || !aggregatedData) {
            toast({ variant: 'destructive', title: 'Cannot Generate', description: 'Please fetch data for a date range first.' });
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedReport('');

        const hasData = aggregatedData.newBreakdowns.length > 0 ||
                        aggregatedData.closedBreakdowns.length > 0 ||
                        aggregatedData.completedSchedules.length > 0 ||
                        aggregatedData.dailyDiaries.length > 0;

        if (!hasData) {
            setGeneratedReport("## No Activity Recorded\n\nNo breakdowns, schedules, or diary entries were found for the selected date range.");
            setIsGenerating(false);
            toast({ title: 'No Data', description: 'There was no activity to report for the selected period.' });
            return;
        }

        const reportInput: ReportInput = {
            startDate: format(date.from, 'yyyy-MM-dd'),
            endDate: format(date.to, 'yyyy-MM-dd'),
            newBreakdowns: aggregatedData.newBreakdowns,
            closedBreakdowns: aggregatedData.closedBreakdowns,
            completedSchedules: aggregatedData.completedSchedules,
            dailyDiaries: aggregatedData.dailyDiaries,
        };
        
        try {
            const result = await generateReport(reportInput);
            setGeneratedReport(result.report);
            toast({ title: 'Report Generated', description: 'The weekly summary report has been created below.' });
        } catch (e: any) {
            console.error(e);
            setError('Failed to generate the report. The AI model may be temporarily unavailable or encountered an error.');
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message || 'An unknown error occurred.' });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleCopy = () => {
        if (!generatedReport) return;
        navigator.clipboard.writeText(generatedReport);
        toast({ title: 'Report Copied', description: 'The report text has been copied to your clipboard.' });
    };

    const handleSaveReport = async () => {
        if (!generatedReport || !date?.from || !date?.to || !user) {
            toast({ variant: 'destructive', title: 'Cannot Save', description: 'No report, date range, or user session found.' });
            return;
        }

        setIsSaving(true);
        try {
            const reportsRef = collection(firestore, 'generated_reports');
            const reportData: Omit<GeneratedReport, 'id'> = {
                reportText: generatedReport,
                startDate: format(date.from, 'yyyy-MM-dd'),
                endDate: format(date.to, 'yyyy-MM-dd'),
                generatedAt: serverTimestamp(),
                generatedByUserId: user.uid,
                generatedByUserName: user.displayName || user.email || 'Unknown User',
            };
            const newDocRef = await addDoc(reportsRef, reportData);
            toast({ title: 'Report Saved', description: 'The generated report has been saved to the history.' });
            router.push(`/reports/history/${newDocRef.id}`);
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the report to the database.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">AI Weekly Report Aggregator</h1>
                <p className="text-muted-foreground">
                    Select a date range to automatically fetch site activity and generate a summary report.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>1. Select Report Period</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button id="date" variant={"outline"} className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/>
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleFetchData} disabled={isFetching}>
                        {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                        {isFetching ? 'Fetching...' : 'Fetch Data'}
                    </Button>
                </CardContent>
            </Card>
            
            {aggregatedData && (
                <Card>
                    <CardHeader>
                        <CardTitle>2. Data Summary</CardTitle>
                        <CardDescription>A summary of the data found for the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <p><strong>New Breakdowns:</strong> {aggregatedData.newBreakdowns.length}</p>
                        <p><strong>Closed Breakdowns:</strong> {aggregatedData.closedBreakdowns.length}</p>
                        <p><strong>Schedules Completed:</strong> {aggregatedData.completedSchedules.length}</p>
                        <p><strong>Daily Diaries Logged:</strong> {aggregatedData.dailyDiaries.length}</p>
                        <div className="md:col-span-full">
                             <Button onClick={handleGenerateReport} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                {isGenerating ? 'Generating...' : 'Generate AI Report'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {generatedReport && (
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><FileText /> 3. Generated Report</CardTitle>
                            <CardDescription>Review the report below. You can copy it or save it to the report history.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleCopy}><Copy className="mr-2 h-4 w-4" />Copy</Button>
                            <Button onClick={handleSaveReport} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {isSaving ? 'Saving...' : 'Save Report'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted rounded-md border font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                            {generatedReport}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
