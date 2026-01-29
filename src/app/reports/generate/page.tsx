
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Copy, Save, Calendar as CalendarIcon, Database } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { collection, serverTimestamp, addDoc, query, where, getDocs } from 'firebase/firestore';
import type { GeneratedReport, Breakdown, CompletedSchedule, DailyDiary, Equipment } from '@/lib/types';
import { generateReport, type ReportInput } from '@/ai/flows/generate-report-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AggregatedData {
    newBreakdowns: Breakdown[];
    closedBreakdowns: Breakdown[];
    completedSchedules: CompletedSchedule[];
    dailyDiaries: DailyDiary[];
    equipment: Equipment[];
}

const sanitizeForServer = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeForServer);
  } else if (data !== null && typeof data === 'object') {
    // Check if it's a Firestore Timestamp (has seconds/nanoseconds)
    if ('seconds' in data && 'nanoseconds' in data && typeof data.toDate === 'function') {
      return data.toDate().toISOString();
    }
    // Check if it's a generic Date object
    if (data instanceof Date) {
      return data.toISOString();
    }
    // Recursively clean object keys
    const cleanObj: any = {};
    for (const key in data) {
      cleanObj[key] = sanitizeForServer(data[key]);
    }
    return cleanObj;
  }
  return data; // Return primitives as is
};


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
    const [customQuery, setCustomQuery] = useState('');

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
            
            const equipmentQuery = collection(firestore, 'equipment');

            const [newBreakdownsSnap, closedBreakdownsSnap, schedulesSnap, diariesSnap, equipmentSnap] = await Promise.all([
                getDocs(newBreakdownsQuery),
                getDocs(closedBreakdownsQuery),
                getDocs(schedulesQuery),
                getDocs(diariesQuery),
                getDocs(equipmentQuery),
            ]);

            const fetchedData: AggregatedData = {
                newBreakdowns: newBreakdownsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Breakdown)),
                closedBreakdowns: closedBreakdownsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Breakdown)),
                completedSchedules: schedulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompletedSchedule)),
                dailyDiaries: diariesSnap.docs.map(doc => {
                    const data = doc.data();
                    if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                        data.createdAt = data.createdAt.toDate().toISOString();
                    }
                    return { id: doc.id, ...data } as DailyDiary;
                }),
                equipment: equipmentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment)),
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
        
        if (!customQuery.trim()) {
            const hasActivity = aggregatedData.newBreakdowns.length > 0 ||
                                aggregatedData.closedBreakdowns.length > 0 ||
                                aggregatedData.completedSchedules.length > 0 ||
                                aggregatedData.dailyDiaries.length > 0;

            if (!hasActivity) {
                setGeneratedReport("## No Activity Recorded\n\nNo breakdowns, schedules, or diary entries were found for the selected date range.");
                setIsGenerating(false);
                toast({ title: 'No Data', description: 'There was no activity to report for the selected period.' });
                return;
            }
        }
        
        const minimizedEquipment = (aggregatedData.equipment || []).map((item: any) => ({
            name: item.name,
            serialNumber: item.serialNumber || 'N/A',
            plant: item.plant || 'Unknown',
            division: item.division || 'Unknown',
            status: item.status || 'Unknown',
            location: item.location || '',
            vsdId: item.vsdId || '',
        }));

        const reportInput: ReportInput = {
            startDate: format(date.from, 'yyyy-MM-dd'),
            endDate: format(date.to, 'yyyy-MM-dd'),
            customQuery: customQuery,
            newBreakdowns: sanitizeForServer(aggregatedData.newBreakdowns),
            closedBreakdowns: sanitizeForServer(aggregatedData.closedBreakdowns),
            completedSchedules: sanitizeForServer(aggregatedData.completedSchedules),
            dailyDiaries: sanitizeForServer(aggregatedData.dailyDiaries),
            equipment: minimizedEquipment,
        };
        
        try {
            const result = await generateReport(reportInput);
            
            // --- FIX: CLEAN THE TEXT ---
            let finalText = result.report;

            // 1. Convert literal "\n" strings to actual line breaks
            finalText = finalText.replace(/\\n/g, '\n');

            // 2. Remove any accidental wrapping quotes
            finalText = finalText.replace(/^"|"$/g, '');

            setGeneratedReport(finalText);

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
                <h1 className="text-3xl font-bold tracking-tight">AI Report Aggregator</h1>
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
                <>
                <Card>
                    <CardHeader>
                        <CardTitle>Data Summary</CardTitle>
                        <CardDescription>A summary of the data found for the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <p><strong>New Breakdowns:</strong> {aggregatedData.newBreakdowns.length}</p>
                        <p><strong>Closed Breakdowns:</strong> {aggregatedData.closedBreakdowns.length}</p>
                        <p><strong>Schedules Completed:</strong> {aggregatedData.completedSchedules.length}</p>
                        <p><strong>Daily Diaries Logged:</strong> {aggregatedData.dailyDiaries.length}</p>
                        <p><strong>Equipment Assets:</strong> {aggregatedData.equipment.length}</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>2. Custom Question / Focus Area (Optional)</CardTitle>
                        <CardDescription>
                            Ask a specific question about your data. If you leave this blank, a standard weekly report will be generated.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Example: List all VSDs missing serial numbers, or Show maintenance due this month."
                            value={customQuery}
                            onChange={(e) => setCustomQuery(e.target.value)}
                        />
                    </CardContent>
                </Card>

                <div className="flex justify-start">
                     <Button onClick={handleGenerateReport} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isGenerating ? 'Generating...' : 'Generate AI Report'}
                    </Button>
                </div>
                </>
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
                        <div className="bg-white p-8 md:p-12 border shadow-sm print:shadow-none print:border-none min-h-[29.7cm] mx-auto max-w-[21cm]">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            className="space-y-6 font-sans text-slate-800 leading-relaxed"
                            components={{
                            // Main Title (H1) - Big, Bold, Uppercase, with a thick bottom border
                            h1: ({ node, ...props }) => (
                                <h1 className="text-3xl font-extrabold text-slate-900 mb-8 pb-4 border-b-4 border-slate-800 uppercase tracking-tight" {...props} />
                            ),
                            // Section Headings (H2) - Bold with a thin divider line
                            h2: ({ node, ...props }) => (
                                <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4 border-b border-slate-300 pb-1 break-after-avoid" {...props} />
                            ),
                            // Sub-headings (H3) - Underlined as requested
                            h3: ({ node, ...props }) => (
                                <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2 underline decoration-slate-400 underline-offset-4" {...props} />
                            ),
                            // Bullet Points - Specific disc style and spacing
                            ul: ({ node, ...props }) => (
                                <ul className="list-disc list-outside pl-6 space-y-2 mb-4 text-slate-700" {...props} />
                            ),
                            // Numbered Lists
                            ol: ({ node, ...props }) => (
                                <ol className="list-decimal list-outside pl-6 space-y-2 mb-4 text-slate-700" {...props} />
                            ),
                            // Paragraphs - Justified text for professional look
                            p: ({ node, ...props }) => (
                                <p className="mb-4 text-justify text-sm md:text-base" {...props} />
                            ),
                            // Tables - Full width with clear borders
                            table: ({ node, ...props }) => (
                                <div className="overflow-x-auto my-6">
                                <table className="min-w-full border-collapse border border-slate-300 text-sm" {...props} />
                                </div>
                            ),
                            thead: ({ node, ...props }) => <thead className="bg-slate-100" {...props} />,
                            th: ({ node, ...props }) => (
                                <th className="border border-slate-300 px-4 py-2 text-left font-bold text-slate-900" {...props} />
                            ),
                            td: ({ node, ...props }) => (
                                <td className="border border-slate-300 px-4 py-2 text-slate-700 align-top" {...props} />
                            ),
                            // Blockquotes - For notes or key takeaways
                            blockquote: ({ node, ...props }) => (
                                <blockquote className="border-l-4 border-slate-400 pl-4 italic text-slate-600 my-4" {...props} />
                            ),
                            }}
                        >
                            {generatedReport}
                        </ReactMarkdown>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
