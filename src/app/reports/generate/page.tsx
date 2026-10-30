'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Copy, Save, Calendar as CalendarIcon, Database, ShieldAlert, Check, Play, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import Image from 'next/image';

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


export interface ReportPromptPreset {
    id: string;
    title: string;
    badge: string;
    badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
    description: string;
    prompt: string;
}

export const REPORT_PROMPT_PRESETS: ReportPromptPreset[] = [
    {
        id: 'key-operations-by-site',
        title: 'Key Operations by Site (Week 38 PDF)',
        badge: 'Target PDF Style',
        badgeVariant: 'default',
        description: 'Categorizes maintenance data by site (MPE, MPC, MPA, MPD). Creates bolded site headings, bolded asset titles (e.g. TB25 Breakdown:), and detailed technical narrative paragraphs of faults, diagnostics, and resolutions.',
        prompt: `Categorize the provided maintenance data by site (e.g., MPE, MPC, MPA, MPD). For each site, create a bolded heading. Below each heading, provide a bolded title for the specific asset (e.g., TB25 Breakdown:), followed by a concise, professional summary of the fault, the diagnostics performed, and the resolution.`
    },
    {
        id: 'executive-summary',
        title: 'Executive Summary',
        badge: 'Executive Brief',
        badgeVariant: 'secondary',
        description: 'Generates a 1-2 paragraph Executive Summary focusing on critical path activities, major equipment breakdowns (e.g. VFDs, boosters, winches), and overall plant stability. Flowing professional paragraphs without bullet points.',
        prompt: `Based on the provided raw data for this week, generate a 1-2 paragraph 'Executive Summary'. Focus on the critical path activities, major equipment breakdowns (e.g., VFDs, boosters, winches), and the overall stability of the plant. Do not use bullet points here; write flowing, professional paragraphs.`
    },
    {
        id: 'fsr-breakdown-table',
        title: 'FSR Breakdown Table',
        badge: 'Strict Table',
        badgeVariant: 'outline',
        description: 'Extracts all Field Service Report (FSR) interventions strictly into a Markdown table with exact column headers: | Date | Site | Asset | FSR Number | Status |.',
        prompt: `Extract all Field Service Report (FSR) interventions from the provided data and format them STRICTLY into a Markdown table.
You MUST use these exact column headers:
| Date | Site | Asset | FSR Number | Status |
You MUST include the markdown separator line |---|---|---|---|---| immediately below the headers. Do not output any text before or after the table.`
    },
    {
        id: 'fsr-analytical-summary',
        title: 'FSR Analytical Summary',
        badge: 'Analysis',
        badgeVariant: 'secondary',
        description: 'Reviews FSR table data and generates a single paragraph titled "Analytical Insights from FSR Data:" summarizing key themes, optimized deployment times, and critical asset attention.',
        prompt: `Review the provided FSR table data. Write a single paragraph titled 'Analytical Insights from FSR Data:' that summarizes the key themes of these interventions. Highlight if tasks were grouped to optimize deployment time or if specific critical assets (like Motor Control Centers or Tails Boosters) required the most attention.`
    },
    {
        id: 'daily-diaries-table',
        title: 'Daily Diaries Table',
        badge: 'Strict Table',
        badgeVariant: 'outline',
        description: 'Extracts daily diary logs strictly into a Markdown table with exact column headers: | Date | Technician | Site | Activity Summary |.',
        prompt: `Extract the daily diary logs from the provided data and format them STRICTLY into a Markdown table.
You MUST use these exact column headers:
| Date | Technician | Site | Activity Summary |
Include the separator line |---|---|---|---| . Do not output any text before or after the table.`
    },
    {
        id: 'full-modular-report',
        title: 'Full Modular Weekly Report (Complete Week 38 Standard)',
        badge: 'Complete Document',
        badgeVariant: 'default',
        description: 'Stitches the full document together: Executive Summary + Key Operations by Site (MPE, MPC, MPD, MPA) + FSR & Diary summaries + Safety, Incidents & Administrative Updates.',
        prompt: `Generate a complete, formal Weekly Service & Maintenance Report combining all key sections in the Altek Green management style:

# Weekly Service & Maintenance Report
**Prepared By:** Fritz Schroeder, Services Manager (KZN)  
**Reporting Period:** Weekly Activity Period (Week 43)

## Executive Summary
Write 1-2 flowing professional paragraphs on critical path activities, major equipment breakdowns, and overall plant stability. Do not use bullet points here.

## Key Operations by Site
Categorize all maintenance data by site (MPE, MPC, MPD, MPA). For each site, create a bolded heading. Below each heading, provide a bolded title for each asset (e.g. • **[Equipment Name / Breakdown]**:), followed by a concise, professional summary of the fault, diagnostics performed, and the resolution.

## Field Service Report (FSR) Interventions
Extract all FSR interventions strictly into this table:
| Date | Site | Asset | FSR Number | Status |
|---|---|---|---|---|

Followed by a concise paragraph titled 'Analytical Insights from FSR Data:' summarizing key themes and critical assets.

## Scheduled and Unscheduled Maintenance (Daily Diaries)
Extract all daily diary interventions strictly into this table:
| Date | Technician | Site | Activity Summary |
|---|---|---|---|

## Safety, Incidents & Administrative Updates
Include 3 distinct bullet points:
- **Reporting Discipline:** Emphasize real-time app submission, accurate arrival/departure logging on FSRs, and cost-center allocations.
- **Site Compliance:** Confirm zero lost-time injuries, safety incidents, or environmental non-conformances.
- **Preventative Facilities Maintenance:** Highlight housekeeping, MCC panel dust/thermal inspection, and risk mitigation.`
    }
];

export function buildCombinedPrompt(selectedIds: string[]): string {
    if (!selectedIds || selectedIds.length === 0) {
        return '';
    }

    if (selectedIds.length === 1) {
        const found = REPORT_PROMPT_PRESETS.find(p => p.id === selectedIds[0]);
        return found ? found.prompt : '';
    }

    const modularKeys = ['key-operations-by-site', 'executive-summary', 'fsr-breakdown-table', 'fsr-analytical-summary', 'daily-diaries-table'];
    const hasAllModular = modularKeys.every(k => selectedIds.includes(k));
    if (selectedIds.includes('full-modular-report') || hasAllModular) {
        const fullPreset = REPORT_PROMPT_PRESETS.find(p => p.id === 'full-modular-report');
        if (fullPreset) return fullPreset.prompt;
    }

    const canonicalOrder = [
        'executive-summary',
        'key-operations-by-site',
        'fsr-breakdown-table',
        'fsr-analytical-summary',
        'daily-diaries-table'
    ];

    const activeOrderedIds = canonicalOrder.filter(id => selectedIds.includes(id));
    selectedIds.forEach(id => {
        if (!activeOrderedIds.includes(id) && id !== 'full-modular-report') {
            activeOrderedIds.push(id);
        }
    });

    const sectionsText: string[] = [];

    activeOrderedIds.forEach(id => {
        switch (id) {
            case 'executive-summary':
                sectionsText.push(`## Executive Summary
Based on the provided raw data for this period, generate a 1-2 paragraph 'Executive Summary'. Focus on the critical path activities, major equipment breakdowns (e.g., VFDs, boosters, winches), and overall plant stability. Do not use bullet points here; write flowing, professional paragraphs.`);
                break;
            case 'key-operations-by-site':
                sectionsText.push(`## Key Operations by Site
Categorize the provided maintenance data by site (e.g., MPE, MPC, MPA, MPD). For each site, create a bolded heading. Below each heading, provide a bolded title for the specific asset (e.g., • **[Equipment Name / Breakdown]**:), followed by a concise, professional summary of the fault, diagnostics performed, and the resolution.`);
                break;
            case 'fsr-breakdown-table':
                sectionsText.push(`## After Hours Breakdowns (16:00 to 07:00) - Field Service Reports
Extract all Field Service Report (FSR) interventions from the provided data and format them STRICTLY into a Markdown table.
You MUST use these exact column headers:
| Date | Site | Asset | FSR Number | Status |
|---|---|---|---|---|
Ensure the markdown separator line is included immediately below the headers.`);
                break;
            case 'fsr-analytical-summary':
                sectionsText.push(`### Analytical Insights from FSR Data
Review the provided FSR table data. Write a single concise paragraph summarizing the key themes of these interventions. Highlight if tasks were grouped to optimize deployment time or if specific critical assets (like Motor Control Centers or Tails Boosters) required the most attention.`);
                break;
            case 'daily-diaries-table':
                sectionsText.push(`## Scheduled & Unscheduled Maintenance (Office Hours) - Daily Diaries
Extract the daily diary logs from the provided data and format them STRICTLY into a Markdown table.
You MUST use these exact column headers:
| Date | Technician | Site | Activity Summary |
|---|---|---|---|
Ensure the markdown separator line is included immediately below the headers.`);
                break;
            default: {
                const found = REPORT_PROMPT_PRESETS.find(p => p.id === id);
                if (found) {
                    sectionsText.push(`## ${found.title}\n${found.prompt}`);
                }
                break;
            }
        }
    });

    return `Generate a formal, professional Weekly Service & Maintenance Report combining the following selected sections:

# Weekly Service & Maintenance Report
**Prepared By:** Fritz Schroeder, Services Manager (KZN)  
**Reporting Period:** Weekly Activity Period (Week 43)

${sectionsText.join('\n\n')}`;
}

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
    const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);

    const togglePreset = (presetId: string) => {
        setSelectedPresetIds(prev => {
            let next: string[];
            const modularIds = ['key-operations-by-site', 'executive-summary', 'fsr-breakdown-table', 'fsr-analytical-summary', 'daily-diaries-table'];

            if (presetId === 'full-modular-report') {
                if (prev.includes('full-modular-report')) {
                    next = [];
                } else {
                    next = REPORT_PROMPT_PRESETS.map(p => p.id);
                }
            } else {
                if (prev.includes(presetId)) {
                    next = prev.filter(id => id !== presetId && id !== 'full-modular-report');
                } else {
                    next = [...prev, presetId];
                    if (modularIds.every(id => next.includes(id))) {
                        if (!next.includes('full-modular-report')) {
                            next.push('full-modular-report');
                        }
                    }
                }
            }
            setCustomQuery(buildCombinedPrompt(next));
            return next;
        });
    };

    const handleSelectAllPresets = () => {
        const allIds = REPORT_PROMPT_PRESETS.map(p => p.id);
        setSelectedPresetIds(allIds);
        setCustomQuery(buildCombinedPrompt(allIds));
    };

    const handleClearPresets = () => {
        setSelectedPresetIds([]);
        setCustomQuery('');
    };

    const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userData, isLoading: userDataLoading } = useDoc<User>(userRoleRef);

    useEffect(() => {
      setDate({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 }),
      });
    }, []);

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


    const handleGenerateReport = async (queryOverride?: string) => {
        if (!date?.from || !date?.to || !aggregatedData) {
            toast({ variant: 'destructive', title: 'Cannot Generate', description: 'Please fetch data for a date range first.' });
            return;
        }

        const effectiveQuery = queryOverride !== undefined ? queryOverride : customQuery;

        setIsGenerating(true);
        setError(null);
        setGeneratedReport('');
        
        // Records with no `status` field are treated as active (new equipment is seeded as 'active').
        const missingStatus = (aggregatedData.equipment || []).filter((item: any) => !item.status);
        if (missingStatus.length > 0) {
            console.table(missingStatus.map((item: any) => ({ id: item.id, name: item.name, location: item.location })));
            toast({
                title: `${missingStatus.length} equipment record(s) have no status`,
                description: 'They were treated as active in this report. See the browser console for the list.',
            });
        }

        const criticalEquipment = (aggregatedData.equipment || [])
            .filter((item: any) => (item.status || 'active') !== 'active' || (item.breakdownStatus && item.breakdownStatus !== 'None'))
            .map((item: any) => ({
                name: item.name || 'Unknown Unit',
                status: item.status || 'active',
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
            id: d.id || 'unknown-id',
            contractTitle: d.contractTitle || 'Contractor Daily Diary',
            contractorName: d.contractorName || '',
            date: d.date,
            area: d.area || '',
            works: d.works?.map(w => ({ scope: w.scope, area: w.area }))
        }));

        const minimalFSRs = (aggregatedData.fieldServiceReports || []).map((f: any) => ({
            id: f.id || 'unknown-fsr',
            fsrReference: f.fsrReference || 'N/A',
            date: f.date || 'N/A',
            customer: f.customer || 'N/A',
            site: f.site || 'N/A',
            location: f.location || '',
            assetName: f.assetName || 'N/A',
            status: f.status || 'N/A',
            customerFault: f.customerFault || '',
            techFindings: f.techFindings || '',
            rca: f.rca || '',
            correctiveActions: f.correctiveActions || '',
            recommendations: f.recommendations || ''
        }));

        const reportInput: ReportInput = {
            startDate: format(date.from, 'yyyy-MM-dd'),
            endDate: format(date.to, 'yyyy-MM-dd'),
            customQuery: effectiveQuery,
            newBreakdowns: sanitizeBreakdowns(aggregatedData.newBreakdowns),
            closedBreakdowns: sanitizeBreakdowns(aggregatedData.closedBreakdowns),
            completedSchedules: sanitizeForServer(aggregatedData.completedSchedules),
            dailyDiaries: minimalDiaries as any,
            fieldServiceReports: minimalFSRs as any,
            equipment: criticalEquipment as any,
        };
                try {
            const result = await generateReport(reportInput);
            if (!result.success) {
                throw new Error(result.error || 'Unknown server error');
            }
            let rawText = typeof result.data === 'string' ? result.data : (result.data as any).report || '';
            rawText = rawText.replace(/\\n/g, '\n').replace(/^"|"$/g, '').replace(/:\s*\|/g, ':\n\n|').replace(/([^\n])(\|---)/g, '$1\n$2');
            setGeneratedReport(rawText);
            toast({ title: 'Report Generated', description: 'The weekly summary report has been created below.' });
        } catch (e: any) {
            console.error(e);
            setError(`Failed to generate the report: ${e.message}`);
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


    return (
        <div className="flex flex-col gap-8 p-4 md:p-8 print:p-0 print:gap-0">
            <style>{'@media print { @page { size: portrait; margin: 8mm; } }'}</style>
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
                        <Calendar mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/>
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
                    <CardContent className="grid grid-cols-2 md:grid-cols-7 gap-4">
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">New</p>
                            <p className="text-xl font-bold">{aggregatedData.newBreakdowns.length}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Resolved</p>
                            <p className="text-xl font-bold">{aggregatedData.closedBreakdowns.length}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold mb-1 leading-tight">Scheduled</p>
                            <p className="text-xl font-bold">{aggregatedData.completedSchedules.length}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold mb-1 leading-tight">Unscheduled</p>
                            <p className="text-xl font-bold">
                                {aggregatedData.dailyDiaries.reduce((acc, d) => acc + (d.works?.length || 0), 0)}
                            </p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded border text-center">
                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">FSRs</p>
                            <p className="text-xl font-bold">{aggregatedData.fieldServiceReports.length}</p>
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
                
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 bg-slate-50/50 border-b">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-sm uppercase tracking-widest font-bold text-slate-800 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    2. Report Focus & Modular Template Prompts
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500 mt-1">
                                    Select one or multiple section templates to combine into a unified report, or click &ldquo;Run Section Only&rdquo; to test an individual component.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSelectAllPresets}
                                    className="text-xs h-7 text-primary hover:text-primary font-medium border-primary/30 hover:bg-primary/5"
                                >
                                    <Check className="h-3 w-3 mr-1" /> Select All Sections
                                </Button>
                                {selectedPresetIds.length > 0 && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={handleClearPresets}
                                        className="text-xs h-7 text-muted-foreground hover:text-slate-900 border-slate-300"
                                    >
                                        <RotateCcw className="h-3 w-3 mr-1" /> Clear Selection ({selectedPresetIds.length})
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 space-y-6">
                        {/* 6 Modular Template Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {REPORT_PROMPT_PRESETS.map((preset) => {
                                const isSelected = selectedPresetIds.includes(preset.id);
                                return (
                                    <div
                                        key={preset.id}
                                        onClick={() => togglePreset(preset.id)}
                                        className={cn(
                                            "cursor-pointer p-3.5 rounded-lg border text-left transition-all relative flex flex-col justify-between hover:shadow-md select-none",
                                            isSelected
                                                ? "border-primary bg-primary/5 ring-2 ring-primary shadow-sm"
                                                : "border-slate-200 bg-white hover:border-primary/40"
                                        )}
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={cn(
                                                        "h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                                        isSelected 
                                                            ? "bg-primary border-primary text-white" 
                                                            : "border-slate-300 bg-white hover:border-primary/60"
                                                    )}>
                                                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                                    </div>
                                                    <span className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                                                        {preset.title}
                                                    </span>
                                                </div>
                                                <Badge variant={preset.badgeVariant || "secondary"} className="text-[10px] shrink-0 font-medium">
                                                    {preset.badge}
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed pl-6.5">
                                                {preset.description}
                                            </p>
                                        </div>

                                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between pl-6.5">
                                            <span className={cn(
                                                "text-[10px] font-medium flex items-center gap-1",
                                                isSelected ? "text-primary font-semibold" : "text-slate-500"
                                            )}>
                                                {isSelected ? (
                                                    <>
                                                        <Check className="h-3 w-3 stroke-[3]" /> Included in Combined Report
                                                    </>
                                                ) : (
                                                    "Click to include"
                                                )}
                                            </span>
                                            <Button
                                                size="sm"
                                                variant={isSelected ? "outline" : "secondary"}
                                                disabled={isGenerating}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toast({
                                                        title: "Running Single Section",
                                                        description: `Generating preview for "${preset.title}"...`
                                                    });
                                                    handleGenerateReport(preset.prompt);
                                                }}
                                                className="h-7 text-xs px-2.5 gap-1.5"
                                            >
                                                {isGenerating && isSelected ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Play className="h-3 w-3 fill-current" />
                                                )}
                                                Run Section Only
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Active Prompt Instructions Textarea */}
                        <div className="space-y-1.5 pt-2 border-t">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                    <span>Active Prompt Instructions:</span>
                                    {selectedPresetIds.length > 0 && (
                                        <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded">
                                            {selectedPresetIds.length === 1
                                                ? "1 section selected"
                                                : `${selectedPresetIds.length} sections combined into unified report`}
                                        </span>
                                    )}
                                </label>
                                <span className="text-[11px] text-muted-foreground font-normal">
                                    {selectedPresetIds.length > 0 ? "Editable before running" : "Custom instruction mode"}
                                </span>
                            </div>
                            <Textarea
                                placeholder="Select preset templates above to combine sections, or type custom prompt instructions here..."
                                value={customQuery}
                                onChange={(e) => setCustomQuery(e.target.value)}
                                rows={6}
                                className="bg-white text-xs font-sans leading-relaxed border-slate-200"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                            <p className="text-xs text-muted-foreground">
                                {selectedPresetIds.length > 0 
                                    ? `${selectedPresetIds.length} section(s) selected to generate in a single unified document.`
                                    : "Ready to generate? Ensure your date range is fetched above."}
                            </p>
                            <Button 
                                onClick={() => handleGenerateReport()} 
                                disabled={isGenerating} 
                                size="lg" 
                                className="w-full sm:w-auto bg-primary hover:bg-primary/90 gap-2 shadow-sm font-semibold"
                            >
                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                {isGenerating 
                                    ? 'Synthesizing Report...' 
                                    : selectedPresetIds.length > 1
                                        ? `Generate Combined Report (${selectedPresetIds.length} Sections Selected)`
                                        : selectedPresetIds.length === 1
                                            ? 'Generate Report (1 Section Selected)'
                                            : 'Generate AI Report'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
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
                    <CardContent className="pt-6 print:p-0">
                        <div className="bg-white p-8 md:p-12 border shadow-sm print:shadow-none print:border-none print:p-0 min-h-[29.7cm] print:min-h-0 mx-auto max-w-[21cm] print:max-w-none print:w-full">
                            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-8">
                                <div className="w-1/3">
                                <img src="/Altek-Logo.jpeg" alt="Altek Green Logo" className="h-20 w-auto object-contain" />
                                </div>
                                <div className="text-right text-[10px] text-slate-600 space-y-1 font-sans">
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">ALTEK GREEN (PTY) LTD</h2>
                                <div className="space-y-0">
                                    <p>9A Langwa Street, Strijdom Park</p>
                                    <p>Randburg, 2194</p>
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

                        <div className="mt-16 pt-8 border-t border-slate-300 flex justify-start relative h-32 w-64 print:mt-6 print:pt-4 print:h-24 print:break-inside-avoid">
                            <Image src="/signature.png" alt="Signature" fill className="object-contain" />
                        </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
