'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Copy, Save, Calendar as CalendarIcon, Database, ShieldAlert } from 'lucide-react';
import { useFirestore, useUser, useMemoFirebase, useDoc } from '@/firebase';
import { collection, serverTimestamp, addDoc, query, where, getDocs, doc } from 'firebase/firestore';
import type { GeneratedReport, Breakdown, CompletedSchedule, DailyDiary, Equipment, User, FieldServiceReport } from '@/lib/types';
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
    fieldServiceReports: FieldServiceReport[];
}

const sanitizeForServer = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeForServer);
  } else if (data !== null && typeof data === 'object') {
    if ('seconds' in data && 'nanoseconds' in data && typeof data.toDate === 'function') {
      return data.toDate().toISOString();
    }
    if (data instanceof Date) {
      return data.toISOString();
    }
    const cleanObj: any = {};
    for (const key in data) {
      cleanObj[key] = sanitizeForServer(data[key]);
    }
    return cleanObj;
  }
  return data;
};


export default function GenerateReportPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const router = useRouter();

    const [isFetching, setIsFetching] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedReport, setGeneratedReport] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<DateRange | undefined>();
    const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null);
    const [customQuery, setCustomQuery] = useState('');

    const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userData, isLoading: userDataLoading } = useDoc<User>(userRoleRef);

    useEffect(() => {
      setDate({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 }),
      });
    }, []);

    const isClientManager = userData?.role === 'Client Manager';

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
            
            const fsrQuery = query(
                collection(firestore, 'field_service_reports'),
                where('date', '>=', startDate),
                where('date', '<=', endDate)
            );
            
            const equipmentQuery = collection(firestore, 'equipment');

            const [newBreakdownsSnap, closedBreakdownsSnap, schedulesSnap, diariesSnap, fsrSnap, equipmentSnap] = await Promise.all([
                getDocs(newBreakdownsQuery),
                getDocs(closedBreakdownsQuery),
                getDocs(schedulesQuery),
                getDocs(diariesQuery),
                getDocs(fsrQuery),
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
                fieldServiceReports: fsrSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FieldServiceReport)),
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
        
        const criticalEquipment = (aggregatedData.equipment || [])
            .filter((item: any) => item.status !== 'active' || (item.breakdownStatus && item.breakdownStatus !== 'None'))
            .map((item: any) => ({
                name: item.name || 'Unknown Unit',
                status: item.status || 'Unknown',
                location: item.location || '',
                flag: item.breakdownStatus || 'N/A'
            }));

        const sanitizeBreakdowns = (list: Breakdown[]) => list.map(b => ({
            id: b.id,
            equipmentName: b.equipmentName || 'Unknown Equipment',
            component: b.component || 'Other',
            date: b.date || '',
            resolved: !!b.resolved,
            resolution: b.resolution || 'Work completed.',
            timeBackInService: b.timeBackInService || null
        }));

        const minimalDiaries = aggregatedData.dailyDiaries.map(d => ({
            date: d.date,
            works: d.works?.map(w => ({ scope: w.scope }))
        }));

        const reportInput: ReportInput = {
            startDate: format(date.from, 'yyyy-MM-dd'),
            endDate: format(date.to, 'yyyy-MM-dd'),
            customQuery: customQuery,
            newBreakdowns: sanitizeBreakdowns(aggregatedData.newBreakdowns),
            closedBreakdowns: sanitizeBreakdowns(aggregatedData.closedBreakdowns),
            completedSchedules: sanitizeForServer(aggregatedData.completedSchedules),
            dailyDiaries: minimalDiaries as any,
            fieldServiceReports: sanitizeForServer(aggregatedData.fieldServiceReports),
            equipment: criticalEquipment as any,
        };
        
        try {
            const result = await generateReport(reportInput);
            let rawText = typeof result === 'string' ? result : (result as any).report || '';
            rawText = rawText.replace(/\\n/g, '\n').replace(/^"|"$/g, '').replace(/:\s*\|/g, ':\n\n|').replace(/([^\n])(\|---)/g, '$1\n$2');
            setGeneratedReport(rawText);
            toast({ title: 'Report Generated', description: 'The weekly summary report has been created below.' });
        } catch (e: any) {
            console.error(e);
            setError('Failed to generate the report. The AI model may be temporarily unavailable or the data payload is too large.');
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
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the report.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (userDataLoading || isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    if (isClientManager) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
                <p className="text-muted-foreground max-w-xs mt-2">
                    AI Report Generation is restricted to internal Altek maintenance and corporate staff.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <style>{'@media print { @page { size: portrait; } }'}</style>
            <header>
                <h1 className="text-3xl font-bold tracking-tight">AI Report Aggregator</h1>
                <p className="text-muted-foreground text-sm">
                    Select a date range to automatically fetch site activity and generate a summary report.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground">1. Select Report Period</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button id="date" variant={"outline"} className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
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
                        <CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Data Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">New</p>
                            <p className="text-xl font-bold">{aggregatedData.newBreakdowns.length}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Resolved</p>
                            <p className="text-xl font-bold">{aggregatedData.closedBreakdowns.length}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Schedules</p>
                            <p className="text-xl font-bold">{aggregatedData.completedSchedules.length}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Diaries</p>
                            <p className="text-xl font-bold">{aggregatedData.dailyDiaries.length}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Assets</p>
                            <p className="text-xl font-bold">{aggregatedData.equipment.length}</p>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground">2. Focus Area (Optional)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Example: Summarize any issues with the MPA Pump Station..."
                            value={customQuery}
                            onChange={(e) => setCustomQuery(e.target.value)}
                            className="bg-white"
                        />
                    </CardContent>
                </Card>

                <div className="flex justify-start">
                     <Button onClick={handleGenerateReport} disabled={isGenerating} size="lg" className="bg-primary hover:bg-primary/90">
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isGenerating ? 'Synthesizing...' : 'Generate AI Report'}
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
                 <Card className="border-emerald-200">
                    <CardHeader className="flex flex-row items-center justify-between bg-emerald-50/50 border-b">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-emerald-800"><FileText className="h-5 w-5" /> 3. Generated Report</CardTitle>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleCopy} className="bg-white"><Copy className="mr-2 h-4 w-4" />Copy</Button>
                            <Button size="sm" onClick={handleSaveReport} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save to History
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="bg-white p-8 md:p-12 border shadow-sm print:shadow-none print:border-none min-h-[29.7cm] mx-auto max-w-[21cm]">
                            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-8">
                                <div className="w-1/3">
                                <img src="/Altek-Logo.jpeg" alt="Altek Green Logo" className="h-20 w-auto object-contain" />
                                </div>
                                <div className="text-right text-[10px] text-slate-600 space-y-1 font-sans">
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">ALTEK GREEN (PTY) LTD</h2>
                                <div className="space-y-0">
                                    <p>163 Van Der Bijl Street, Unit 6 Astro Place</p>
                                    <p>Meadowdale, Johannesburg, 1614</p>
                                </div>
                                </div>
                            </div>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            className="space-y-6 font-sans text-slate-800 leading-relaxed"
                            components={{
                            h1: () => null,
                            h2: ({ node, ...props }) => (
                                <h2 className="text-lg font-bold text-slate-900 mt-8 mb-4 border-b border-slate-300 pb-1 break-after-avoid" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                                <h3 className="text-base font-bold text-slate-800 mt-6 mb-2 underline decoration-slate-400 underline-offset-4" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                                <ul className="list-disc list-outside pl-6 space-y-2 mb-4 text-slate-700 text-sm" {...props} />
                            ),
                            p: ({ node, ...props }) => (
                                <p className="mb-4 text-justify text-xs md:text-sm" {...props} />
                            ),
                            table: ({ node, ...props }) => (
                                <div className="overflow-x-auto my-6 border rounded-lg">
                                <table className="min-w-full border-collapse text-[10px] md:text-xs" {...props} />
                                </div>
                            ),
                            thead: ({ node, ...props }) => <thead className="bg-slate-100" {...props} />,
                            th: ({ node, ...props }) => (
                                <th className="border-b border-slate-300 px-4 py-2 text-left font-bold text-slate-900 uppercase tracking-wider" {...props} />
                            ),
                            td: ({ node, ...props }) => (
                                <td className="border-b border-slate-200 px-4 py-2 text-slate-700 align-top" {...props} />
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
