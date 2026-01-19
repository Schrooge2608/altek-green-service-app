'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Copy, Calendar as CalendarIcon } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Breakdown, CompletedSchedule, DailyDiary } from '@/lib/types';
import { generateReport, type ReportInput } from '@/ai/flows/generate-report-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';

export default function GenerateReportPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    const [generatedReport, setGeneratedReport] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    });

    const handleCopy = () => {
        if (!generatedReport) return;
        navigator.clipboard.writeText(generatedReport);
        toast({ title: 'Report Copied', description: 'The report text has been copied to your clipboard.' });
    };

    const handleGenerateReport = async () => {
        if (!date?.from || !date?.to) {
            toast({ variant: 'destructive', title: 'No Date Range Selected', description: 'Please select a start and end date for the report.' });
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedReport('');

        try {
            const startDateStr = format(date.from, 'yyyy-MM-dd');
            const endDateStr = format(date.to, 'yyyy-MM-dd');

            // Fetch Breakdowns
            const breakdownsQuery = query(collection(firestore, 'breakdown_reports'), where('date', '>=', startDateStr), where('date', '<=', endDateStr));
            const breakdownSnap = await getDocs(breakdownsQuery);
            const breakdowns = breakdownSnap.docs.map(doc => doc.data() as Breakdown);

            // Fetch Completed Schedules
            const schedulesQuery = query(collection(firestore, 'completed_schedules'), where('completionDate', '>=', startDateStr), where('completionDate', '<=', endDateStr));
            const schedulesSnap = await getDocs(schedulesQuery);
            const completedSchedules = schedulesSnap.docs.map(doc => doc.data() as CompletedSchedule);

            // Fetch Daily Diaries for Unscheduled Work
            const diariesQuery = query(collection(firestore, 'daily_diaries'), where('date', '>=', startDateStr), where('date', '<=', endDateStr));
            const diariesSnap = await getDocs(diariesQuery);
            const dailyDiaries = diariesSnap.docs.map(doc => doc.data() as DailyDiary);
            
            const unscheduledWork = dailyDiaries.flatMap(diary =>
                diary.works?.filter(w => w.scope && w.scope.toLowerCase().includes('unscheduled'))
                .map(w => ({
                    scope: w.scope || 'No scope provided',
                    date: diary.date,
                })) || []
            );

            const reportInput: ReportInput = {
                startDate: startDateStr,
                endDate: endDateStr,
                breakdowns: breakdowns.map(b => ({
                    equipmentName: b.equipmentName,
                    date: b.date,
                    description: b.description,
                    status: b.resolved ? 'Resolved' : 'Pending',
                })),
                completedSchedules: completedSchedules.map(s => ({
                    equipmentName: s.equipmentName,
                    maintenanceType: s.maintenanceType,
                    frequency: s.frequency,
                    completionDate: s.completionDate,
                })),
                unscheduledWork: unscheduledWork,
            };
            
            const result = await generateReport(reportInput);

            setGeneratedReport(result.report);
            toast({ title: 'Report Generated', description: 'The weekly summary report has been created below.' });
        } catch (e: any) {
            console.error(e);
            setError('Failed to generate the report. The AI model may be temporarily unavailable or the data could not be fetched.');
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message || 'An unknown error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">AI Weekly Report Generator</h1>
                <p className="text-muted-foreground">
                    Generate a comprehensive, client-friendly summary report for a selected period.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Report Period</CardTitle>
                    <CardDescription>Select the date range for the report. It defaults to the current week.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Pick a date range</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                        />
                        </PopoverContent>
                    </Popover>
                    <div>
                        <Button onClick={handleGenerateReport} disabled={isLoading || !date?.from || !date?.to}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            {isLoading ? 'Gathering Data & Generating...' : 'Generate Weekly Report'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

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
                            <CardTitle className="flex items-center gap-2"><FileText /> Generated Report</CardTitle>
                            <CardDescription>Review the report below. You can copy it to your clipboard.</CardDescription>
                        </div>
                        <Button variant="outline" onClick={handleCopy}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Report
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-muted rounded-md border font-mono text-sm whitespace-pre-wrap">
                            {generatedReport}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
