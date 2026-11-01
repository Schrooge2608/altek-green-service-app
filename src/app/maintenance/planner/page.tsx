'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Sparkles, 
  FileText, 
  Copy, 
  Save, 
  Calendar as CalendarIcon, 
  Database, 
  Printer, 
  MessageCircle, 
  RotateCcw, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Wrench,
  Check,
  Send,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, useMemoFirebase, useDoc } from '@/firebase';
import { collection, serverTimestamp, addDoc, query, where, getDocs, doc } from 'firebase/firestore';
import type { Breakdown, CompletedSchedule, DailyDiary, Equipment, User, FieldServiceReport, GeneratedReport } from '@/lib/types';
import { generateMaintenancePlan, type MaintenancePlanInput } from '@/ai/flows/generate-maintenance-plan-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  subDays, 
  startOfDay, 
  endOfDay, 
  getISOWeek,
  isMonday
} from 'date-fns';
import { cn, formatMarkdownTables } from '@/lib/utils';
import { generateSmartPagedPdf } from '@/lib/pdf-utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

interface AggregatedLookbackData {
  newBreakdowns: Breakdown[];
  closedBreakdowns: Breakdown[];
  completedSchedules: CompletedSchedule[];
  dailyDiaries: DailyDiary[];
  equipment: Equipment[];
  fieldServiceReports: FieldServiceReport[];
}

interface PlannerPreset {
  id: string;
  title: string;
  badge: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
  description: string;
  promptDirective: string;
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

export default function AIMaintenancePlannerPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // User Profile
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);

  // 1. Target Week Calculation (Default: Upcoming Week)
  // If Friday (5), Saturday (6), Sunday (0), target next week. If Monday-Thursday, target next week or current.
  const initialTarget = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    // Default to upcoming week
    const targetBase = (day === 5 || day === 6 || day === 0) ? addWeeks(now, 1) : addWeeks(now, 1);
    const from = startOfWeek(targetBase, { weekStartsOn: 1 });
    const to = endOfWeek(targetBase, { weekStartsOn: 1 });
    return { from, to };
  }, []);

  const [targetDateRange, setTargetDateRange] = useState<DateRange>({
    from: initialTarget.from,
    to: initialTarget.to,
  });

  // 2. Historical Lookback Window (Default: Past 90 Days)
  const [lookbackDays, setLookbackDays] = useState<number>(90);
  const [lookbackRange, setLookbackRange] = useState<DateRange>({
    from: subDays(new Date(), 90),
    to: new Date(),
  });

  // State
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [aggregatedData, setAggregatedData] = useState<AggregatedLookbackData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('full_plan');

  // Computed Target Week details
  const targetWeekNumber = useMemo(() => {
    if (!targetDateRange.from) return getISOWeek(new Date());
    return getISOWeek(targetDateRange.from);
  }, [targetDateRange]);

  const targetPeriodLabel = useMemo(() => {
    if (!targetDateRange.from) return 'Upcoming Week';
    const from = targetDateRange.from;
    const to = targetDateRange.to || targetDateRange.from;
    return `Week ${targetWeekNumber}: ${format(from, 'dd MMM')} – ${format(to, 'dd MMM yyyy')}`;
  }, [targetDateRange, targetWeekNumber]);

  // Presets
  const presets: PlannerPreset[] = useMemo(() => [
    {
      id: 'full_plan',
      title: 'Full Weekly Predictive Plan (Mon – Sun)',
      badge: 'Comprehensive',
      badgeVariant: 'default',
      description: 'Generates the strategic plant overview, critical risk matrix, and day-by-day maintenance schedule for all sites.',
      promptDirective: 'Generate the complete Altek Green Weekly Predictive Maintenance Plan. Analyze all recurring faults and unaddressed FSR recommendations to build an actionable Monday through Sunday schedule.',
    },
    {
      id: 'critical_components',
      title: 'Critical Equipment & Component Health Analysis',
      badge: 'High Risk Focus',
      badgeVariant: 'destructive',
      description: 'Prioritizes assets showing repeat trips (earth faults, IGBT overcurrent, capacitor degradation) and evaluates component failure risk.',
      promptDirective: 'Focus heavily on high-frequency breakdown equipment, repeat VSD trips, capacitor bank age, and motor insulation degradation. Provide a deeply detailed Priority Risk Matrix with explicit root causes and preventative testing instructions.',
    },
    {
      id: 'local_mode_audit',
      title: 'Deferred Work & Local Mode / Bypass Audit',
      badge: 'Safety & Automation',
      badgeVariant: 'secondary',
      description: 'Identifies drives running on Local control, lost DeviceNet/PLC comms, temporary jumpers, or deferred FSR repairs.',
      promptDirective: 'Perform a dedicated audit of latent risks: identify drives running on Local mode without PLC automation, communication line dropouts, bypassed interlocks, and pending repair recommendations that have not yet been closed out.',
    },
    {
      id: 'vsd_pm_focus',
      title: 'VSD, Softstarter & MCC PM Overhauls',
      badge: 'Lifecycle PM',
      badgeVariant: 'outline',
      description: 'Schedules 3-monthly and 6-monthly VSD services, capacitor replacements, fan filter cleaning, and thermal imaging scans.',
      promptDirective: 'Prioritize routine lifecycle renewals: 3-monthly/6-monthly VSD servicing, capacitor renewals, blower fan inspections, busbar torquing, and MCC dust mitigation across MPE, MPC, MPD, MPA, and Smelter.',
    },
  ], []);

  // Update Lookback Quick Select
  const handleLookbackPreset = (days: number) => {
    setLookbackDays(days);
    const now = new Date();
    setLookbackRange({
      from: subDays(now, days),
      to: now,
    });
  };

  // Quick Target Week Select
  const handleTargetWeekOffset = (weekOffset: number) => {
    const now = new Date();
    const target = addWeeks(now, weekOffset);
    const from = startOfWeek(target, { weekStartsOn: 1 });
    const to = endOfWeek(target, { weekStartsOn: 1 });
    setTargetDateRange({ from, to });
  };

  // Fetch Lookback Data
  const fetchData = async () => {
    if (!lookbackRange.from || !lookbackRange.to) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a valid diagnostic lookback window.' });
      return;
    }

    setIsFetchingData(true);
    setError(null);
    setAggregatedData(null);

    try {
      const fromStr = format(startOfDay(lookbackRange.from), 'yyyy-MM-dd');
      const toStr = format(endOfDay(lookbackRange.to), 'yyyy-MM-dd');

      // 1. Breakdowns
      const breakdownsRef = collection(firestore, 'breakdowns');
      const bQuery = query(breakdownsRef, where('date', '>=', fromStr), where('date', '<=', toStr));
      const bSnap = await getDocs(bQuery);
      const allB: Breakdown[] = [];
      bSnap.forEach(doc => allB.push({ id: doc.id, ...doc.data() } as Breakdown));
      const newB = allB.filter(b => !b.resolved);
      const closedB = allB.filter(b => b.resolved);

      // 2. Completed Schedules
      const schedRef = collection(firestore, 'completed_schedules');
      const sQuery = query(schedRef, where('completionDate', '>=', fromStr), where('completionDate', '<=', toStr));
      const sSnap = await getDocs(sQuery);
      const compS: CompletedSchedule[] = [];
      sSnap.forEach(doc => compS.push({ id: doc.id, ...doc.data() } as CompletedSchedule));

      // 3. Daily Diaries
      const diaryRef = collection(firestore, 'contractors_daily_diary');
      const dQuery = query(diaryRef, where('date', '>=', fromStr), where('date', '<=', toStr));
      const dSnap = await getDocs(dQuery);
      const diaries: DailyDiary[] = [];
      dSnap.forEach(doc => diaries.push({ id: doc.id, ...doc.data() } as DailyDiary));

      // 4. Field Service Reports
      const fsrRef = collection(firestore, 'field_service_reports');
      const fQuery = query(fsrRef, where('date', '>=', fromStr), where('date', '<=', toStr));
      const fSnap = await getDocs(fQuery);
      const fsrs: FieldServiceReport[] = [];
      fSnap.forEach(doc => fsrs.push({ id: doc.id, ...doc.data() } as FieldServiceReport));

      // 5. Equipment master list
      const eqRef = collection(firestore, 'equipment');
      const eqSnap = await getDocs(eqRef);
      const eq: Equipment[] = [];
      eqSnap.forEach(doc => eq.push({ id: doc.id, ...doc.data() } as Equipment));

      setAggregatedData({
        newBreakdowns: newB,
        closedBreakdowns: closedB,
        completedSchedules: compS,
        dailyDiaries: diaries,
        equipment: eq,
        fieldServiceReports: fsrs,
      });

      toast({
        title: 'Diagnostic Data Loaded',
        description: `Loaded ${fsrs.length} FSRs, ${diaries.length} Diaries, and ${allB.length} Breakdowns over past ${lookbackDays} days.`,
      });
    } catch (e: any) {
      console.error('Data Fetch Error:', e);
      setError(`Failed to retrieve diagnostic data: ${e.message}`);
      toast({ variant: 'destructive', title: 'Fetch Failed', description: e.message });
    } finally {
      setIsFetchingData(false);
    }
  };

  // Run initial data fetch
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookbackRange.from, lookbackRange.to]);

  // Execute AI Maintenance Plan Generation
  const handleGeneratePlan = async () => {
    if (!aggregatedData) {
      toast({ variant: 'destructive', title: 'No Data', description: 'Please wait for diagnostic data to finish loading.' });
      return;
    }
    if (!targetDateRange.from || !targetDateRange.to) {
      toast({ variant: 'destructive', title: 'Target Week Required', description: 'Please select a target maintenance week.' });
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const activePreset = presets.find(p => p.id === selectedPreset);
      const fullPrompt = [
        activePreset?.promptDirective || '',
        customInstructions.trim(),
      ].filter(Boolean).join('\n\nAdditional Focus Notes:\n');

      const payload: MaintenancePlanInput = {
        lookbackStartDate: format(lookbackRange.from!, 'yyyy-MM-dd'),
        lookbackEndDate: format(lookbackRange.to!, 'yyyy-MM-dd'),
        targetWeek: targetWeekNumber,
        targetStartDate: format(targetDateRange.from, 'yyyy-MM-dd'),
        targetEndDate: format(targetDateRange.to, 'yyyy-MM-dd'),
        customQuery: fullPrompt,
        newBreakdowns: sanitizeForServer(aggregatedData.newBreakdowns),
        closedBreakdowns: sanitizeForServer(aggregatedData.closedBreakdowns),
        completedSchedules: sanitizeForServer(aggregatedData.completedSchedules),
        dailyDiaries: sanitizeForServer(aggregatedData.dailyDiaries),
        fieldServiceReports: sanitizeForServer(aggregatedData.fieldServiceReports),
        equipment: sanitizeForServer(aggregatedData.equipment),
      };

      const result = await generateMaintenancePlan(payload);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'The AI model was unable to generate the plan. Please try again.');
      }

      setGeneratedPlan(result.data.plan);
      toast({ title: 'Maintenance Plan Generated', description: `Plan created successfully for Week ${targetWeekNumber}.` });

      // Smooth scroll to generated plan
      setTimeout(() => {
        reportContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (e: any) {
      console.error('Plan Generation Error:', e);
      setError(e.message || 'An error occurred during generation.');
      toast({ variant: 'destructive', title: 'Generation Failed', description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Markdown to Clipboard
  const handleCopy = () => {
    if (!generatedPlan) return;
    navigator.clipboard.writeText(generatedPlan);
    toast({ title: 'Copied to Clipboard', description: 'The maintenance plan markdown is ready to paste.' });
  };

  // Print PDF
  const handlePrint = () => {
    window.print();
  };

  // WhatsApp / Email Share
  const handleSharePDF = async (method: 'whatsapp' | 'email') => {
    if (!generatedPlan) return;
    const element = document.getElementById('planner-content');
    if (!element) {
      toast({ variant: 'destructive', title: 'Content Not Found', description: 'Could not locate the document element to export.' });
      return;
    }

    setIsSharing(true);
    toast({ title: 'Generating PDF...', description: 'Preparing high-resolution document for export.' });

    try {
      const pdf = await generateSmartPagedPdf(element);
      const pdfBlob = pdf.output('blob');
      const fileName = `AltekGreen_Maintenance_Plan_Week_${targetWeekNumber}_${format(targetDateRange.from!, 'yyyy-MM-dd')}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Altek Green Maintenance Plan - Week ${targetWeekNumber}`,
          text: `Please find the Altek Green Weekly Predictive Maintenance Plan for Week ${targetWeekNumber} (${format(targetDateRange.from!, 'dd MMM')} – ${format(targetDateRange.to!, 'dd MMM yyyy')}).`,
        });
        toast({ title: 'Shared Successfully' });
      } else {
        pdf.save(fileName);
        toast({
          title: 'PDF Downloaded',
          description: 'Direct browser file sharing is unavailable. The PDF has been downloaded—opening WhatsApp so you can attach it.',
        });

        const shareMsg = encodeURIComponent(
          `*Altek Green - Weekly Predictive Maintenance Plan*\n` +
          `*Planning Period:* Week ${targetWeekNumber} (${format(targetDateRange.from!, 'dd MMM')} – ${format(targetDateRange.to!, 'dd MMM yyyy')})\n` +
          `*Prepared By:* Fritz Schroeder, Services Manager\n\n` +
          `Please find the downloaded maintenance plan attached.`
        );

        if (method === 'whatsapp') {
          window.open(`https://api.whatsapp.com/send?text=${shareMsg}`, '_blank');
        } else {
          window.open(`mailto:?subject=Altek Green Maintenance Plan Week ${targetWeekNumber}&body=${shareMsg}`, '_blank');
        }
      }
    } catch (e: any) {
      console.error('PDF Share Error:', e);
      toast({ variant: 'destructive', title: 'Export Failed', description: e.message || 'Failed to export PDF.' });
    } finally {
      setIsSharing(false);
    }
  };

  // WhatsApp Quick Text Summary
  const handleShareWhatsAppText = () => {
    if (!generatedPlan) return;
    // Extract first 1500 chars or summary for direct WhatsApp message
    const cleanSnippet = generatedPlan.slice(0, 1500).replace(/#/g, '').trim();
    const text = encodeURIComponent(
      `*Altek Green Predictive Maintenance Plan (Week ${targetWeekNumber})*\n` +
      `*Period:* ${format(targetDateRange.from!, 'dd MMM')} – ${format(targetDateRange.to!, 'dd MMM yyyy')}\n` +
      `*Prepared By:* Fritz Schroeder\n\n` +
      `${cleanSnippet}...\n\n_(Full official PDF available on portal)_`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Save to Firestore History
  const handleSavePlan = async () => {
    if (!generatedPlan || !user) {
      toast({ variant: 'destructive', title: 'Cannot Save', description: 'No plan content or user not authenticated.' });
      return;
    }

    setIsSaving(true);
    try {
      const reportsRef = collection(firestore, 'generated_reports');
      await addDoc(reportsRef, {
        reportText: generatedPlan,
        title: `Weekly Predictive Maintenance Plan (Week ${targetWeekNumber})`,
        type: 'maintenance_plan',
        targetWeek: targetWeekNumber,
        startDate: format(targetDateRange.from!, 'yyyy-MM-dd'),
        endDate: format(targetDateRange.to!, 'yyyy-MM-dd'),
        lookbackStartDate: format(lookbackRange.from!, 'yyyy-MM-dd'),
        lookbackEndDate: format(lookbackRange.to!, 'yyyy-MM-dd'),
        generatedAt: serverTimestamp(),
        generatedByUserId: user.uid,
        generatedByUserName: userData?.name || user.email || 'Services Manager',
      });

      toast({
        title: 'Plan Saved to History',
        description: `Week ${targetWeekNumber} Maintenance Plan is now archived in Reports History.`,
      });
    } catch (e: any) {
      console.error('Save Plan Error:', e);
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto print:p-0 print:m-0 print:max-w-none">
      <style>{`
        @media print {
          @page { size: portrait; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 print-hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-emerald-600" />
              AI Maintenance Planner
            </h1>
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300">
              Predictive Engineering
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Formulate forward-looking work orders, risk matrices, and weekly maintenance programs from historical FSRs and breakdown trends.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/reports/history">
            <Button variant="outline" size="sm" className="bg-white">
              <Clock className="mr-2 h-4 w-4" />
              Past Plans History
            </Button>
          </Link>
          <Link href="/reports/generate">
            <Button variant="ghost" size="sm" className="text-slate-600">
              <FileText className="mr-2 h-4 w-4" />
              Client Report Generator
            </Button>
          </Link>
        </div>
      </div>

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print-hidden">
        {/* Step 1: Target Week Selection */}
        <Card className="lg:col-span-5 border-emerald-100 shadow-sm">
          <CardHeader className="pb-3 bg-emerald-50/40 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-emerald-950">
                <CalendarIcon className="h-4 w-4 text-emerald-600" />
                1. Target Maintenance Week
              </CardTitle>
              <Badge variant="outline" className="font-mono text-xs bg-white text-emerald-800 border-emerald-200">
                Week {targetWeekNumber}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Select the upcoming week to schedule work orders and component actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={targetDateRange.from && getISOWeek(targetDateRange.from) === getISOWeek(addWeeks(new Date(), 1)) ? 'default' : 'outline'}
                className={targetDateRange.from && getISOWeek(targetDateRange.from) === getISOWeek(addWeeks(new Date(), 1)) ? 'bg-emerald-600 hover:bg-emerald-700 text-xs' : 'text-xs bg-white'}
                onClick={() => handleTargetWeekOffset(1)}
              >
                Next Week (Week {getISOWeek(addWeeks(new Date(), 1))})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={targetDateRange.from && getISOWeek(targetDateRange.from) === getISOWeek(new Date()) ? 'default' : 'outline'}
                className={targetDateRange.from && getISOWeek(targetDateRange.from) === getISOWeek(new Date()) ? 'bg-emerald-600 hover:bg-emerald-700 text-xs' : 'text-xs bg-white'}
                onClick={() => handleTargetWeekOffset(0)}
              >
                Current Week (Week {getISOWeek(new Date())})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs bg-white"
                onClick={() => handleTargetWeekOffset(2)}
              >
                In 2 Weeks (Week {getISOWeek(addWeeks(new Date(), 2))})
              </Button>
            </div>

            <div className="border rounded-md p-3 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Active Planning Window:</p>
                <p className="text-sm font-semibold text-slate-800">
                  {targetPeriodLabel}
                </p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-white text-xs">
                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                    Custom Week
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={targetDateRange.from}
                    selected={targetDateRange}
                    onSelect={(range) => {
                      if (range?.from) {
                        const from = startOfWeek(range.from, { weekStartsOn: 1 });
                        const to = endOfWeek(range.to || range.from, { weekStartsOn: 1 });
                        setTargetDateRange({ from, to });
                      }
                    }}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Diagnostic Lookback History */}
        <Card className="lg:col-span-7 border-slate-200 shadow-sm">
          <CardHeader className="pb-3 bg-slate-50/70 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-900">
                <Database className="h-4 w-4 text-blue-600" />
                2. Historical Diagnostic Lookback
              </CardTitle>
              {isFetchingData ? (
                <div className="flex items-center text-xs text-blue-600 gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing records...
                </div>
              ) : (
                <Badge variant="outline" className="text-xs font-normal bg-white">
                  {aggregatedData ? 'Data Synchronized' : 'Ready'}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              The AI evaluates breakdown frequency, loose terminations, capacitor renewals, and unresolved RCA notes across this window.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[30, 60, 90, 180].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant={lookbackDays === days ? 'default' : 'outline'}
                    className={lookbackDays === days ? 'bg-blue-600 hover:bg-blue-700 text-xs' : 'text-xs bg-white'}
                    onClick={() => handleLookbackPreset(days)}
                  >
                    Past {days} Days {days === 90 && '★'}
                  </Button>
                ))}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs bg-white">
                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                    Custom Dates
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={lookbackRange.from}
                    selected={lookbackRange}
                    onSelect={(range) => {
                      if (range?.from) {
                        setLookbackRange({ from: range.from, to: range.to || range.from });
                        setLookbackDays(Math.round(Math.abs((range.to || range.from).getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000)));
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Diagnostic Data Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-slate-50 border rounded p-2 text-center">
                <span className="text-[11px] text-slate-500 block uppercase font-medium">FSRs Analyzed</span>
                <span className="text-base font-bold text-slate-900">
                  {isFetchingData ? '...' : aggregatedData?.fieldServiceReports.length ?? 0}
                </span>
              </div>
              <div className="bg-slate-50 border rounded p-2 text-center">
                <span className="text-[11px] text-slate-500 block uppercase font-medium">Daily Diaries</span>
                <span className="text-base font-bold text-slate-900">
                  {isFetchingData ? '...' : aggregatedData?.dailyDiaries.length ?? 0}
                </span>
              </div>
              <div className="bg-slate-50 border rounded p-2 text-center">
                <span className="text-[11px] text-slate-500 block uppercase font-medium">Breakdowns</span>
                <span className="text-base font-bold text-slate-900">
                  {isFetchingData ? '...' : (aggregatedData ? aggregatedData.newBreakdowns.length + aggregatedData.closedBreakdowns.length : 0)}
                </span>
              </div>
              <div className="bg-slate-50 border rounded p-2 text-center">
                <span className="text-[11px] text-slate-500 block uppercase font-medium">Plant Assets</span>
                <span className="text-base font-bold text-slate-900">
                  {isFetchingData ? '...' : aggregatedData?.equipment.length ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Predictive Planning Presets & Custom Directives */}
        <Card className="lg:col-span-12 border-slate-200 shadow-sm">
          <CardHeader className="pb-3 bg-slate-50/70 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-900">
              <Layers className="h-4 w-4 text-emerald-600" />
              3. Planning Focus & Predictive Templates
            </CardTitle>
            <CardDescription className="text-xs">
              Choose an engineering objective or customize priority equipment (e.g. MPE tails pumps, Smelter west crane, roaster MCC).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {presets.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={cn(
                      'p-3.5 rounded-lg border text-left cursor-pointer transition-all relative flex flex-col justify-between',
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant={preset.badgeVariant || 'secondary'} className="text-[10px] px-1.5 py-0">
                          {preset.badge}
                        </Badge>
                        {isSelected && <Check className="h-4 w-4 text-emerald-600 font-bold" />}
                      </div>
                      <h4 className="font-semibold text-xs text-slate-900 leading-snug mb-1">
                        {preset.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-normal line-clamp-3">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Focus Textarea */}
            <div className="pt-2">
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Specific Managerial Focus / Technician Allocation Notes (Optional):
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Example: Priority attention on Smelter S30 feeder DeviceNet comms and MPE TB21 cable insulation tests. Allocate David Msane to MPE and Buyani Mthembu to MPD Dredger."
                rows={2}
                className="w-full text-xs p-2.5 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono bg-white"
              />
            </div>

            {/* Generate Button Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t">
              <div className="text-xs text-slate-500">
                Planning for <strong className="text-slate-800">Week {targetWeekNumber}</strong> using <strong className="text-slate-800">{lookbackDays}-day</strong> diagnostic lookback.
              </div>

              <Button
                size="lg"
                onClick={handleGeneratePlan}
                disabled={isGenerating || isFetchingData}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md px-6"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Synthesizing Work Program...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Predictive Maintenance Plan
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="print-hidden">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Generation Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Generated Report Section with Top Action Buttons */}
      {generatedPlan && (
        <div ref={reportContainerRef} className="space-y-4 pt-2">
          {/* Top Action Bar (Print to PDF, WhatsApp, Copy, Save) */}
          <Card className="border-emerald-200 bg-white shadow-sm print-hidden">
            <CardHeader className="py-3 px-4 bg-emerald-50/50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-700" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Weekly Predictive Maintenance Plan (Week {targetWeekNumber})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ready for client review, technician work packs, or team dispatch via WhatsApp.
                  </p>
                </div>
              </div>

              {/* ACTION BUTTONS (As requested by user: Print to PDF, Export to WhatsApp, Copy, Save) */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Print to PDF */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="bg-white border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-medium shadow-sm"
                >
                  <Printer className="mr-1.5 h-4 w-4 text-slate-600" />
                  Print to PDF
                </Button>

                {/* Export to WhatsApp (Smart PDF attachment with Web/App launcher) */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSharePDF('whatsapp')}
                  disabled={isSharing}
                  className="bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-medium shadow-sm"
                >
                  {isSharing ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="mr-1.5 h-4 w-4 text-emerald-600" />
                  )}
                  Export to WhatsApp
                </Button>

                {/* WhatsApp Quick Text Dispatch */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareWhatsAppText}
                  className="hidden md:inline-flex bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                  WhatsApp Text
                </Button>

                {/* Copy Markdown */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="bg-white border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-medium shadow-sm"
                >
                  <Copy className="mr-1.5 h-4 w-4 text-slate-600" />
                  Copy
                </Button>

                {/* Save to History */}
                <Button
                  size="sm"
                  onClick={handleSavePlan}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm"
                >
                  {isSaving ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Save Plan
                </Button>

                {/* Re-run */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePlan}
                  disabled={isGenerating}
                  className="text-slate-600 hover:text-slate-900 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Printable Document Container */}
          <div
            id="planner-content"
            className="bg-white p-8 md:p-12 border shadow-md print:shadow-none print:border-none print:p-0 min-h-[29.7cm] print:min-h-0 mx-auto max-w-[21cm] print:max-w-none print:w-full rounded-sm"
          >
            {/* Formal Engineering Header */}
            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-8">
              <div className="w-1/3">
                <img src="/Altek-Logo.jpeg" alt="Altek Green Logo" className="h-20 w-auto object-contain" />
              </div>
              <div className="text-right text-[10px] text-slate-600 space-y-1 font-sans">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">ALTEK GREEN (PTY) LTD</h2>
                <div className="space-y-0">
                  <p>9A Langwa Street, Strijdom Park</p>
                  <p>Randburg, 2194</p>
                  <p>Tel: +27 11 793 1184</p>
                  <p className="font-semibold text-slate-800">Email: fritz@altekgreen.co.za</p>
                </div>
              </div>
            </div>

            {/* Document Body */}
            <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-emerald-600 prose-img:rounded-md text-sm md:text-base leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 className="text-2xl font-black text-slate-900 border-b-2 border-emerald-600 pb-2 mb-4 mt-6 uppercase tracking-tight block print:mt-2" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-lg font-bold text-slate-800 border-b border-slate-300 pb-1 mt-6 mb-3 print:mt-4 print:break-after-avoid" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-base font-bold text-slate-800 mt-4 mb-2 print:break-after-avoid" {...props} />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4 border rounded-md shadow-sm print:shadow-none print:border-slate-400 print:break-inside-avoid">
                      <table className="w-full text-left border-collapse text-xs md:text-sm" {...props} />
                    </div>
                  ),
                  thead: ({ node, ...props }) => (
                    <thead className="bg-slate-100 border-b border-slate-300 font-semibold text-slate-900 print:bg-slate-200" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="p-2.5 font-bold border-r last:border-r-0 border-slate-200 print:border-slate-400" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="p-2.5 border-t border-r last:border-r-0 border-slate-200 print:border-slate-300 align-top" {...props} />
                  ),
                  tr: ({ node, ...props }) => (
                    <tr className="even:bg-slate-50/60 hover:bg-slate-100/40 print:even:bg-transparent" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc pl-5 my-2 space-y-1.5" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="leading-snug" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className="my-2.5 leading-relaxed text-slate-700" {...props} />
                  ),
                }}
              >
                {formatMarkdownTables(generatedPlan)}
              </ReactMarkdown>
            </div>

            {/* Engineering Sign-off Block */}
            <div className="mt-16 pt-8 border-t border-slate-300 flex justify-between items-end print:mt-8 print:pt-4 print:break-inside-avoid">
              <div className="relative h-28 w-64">
                <img
                  src="/fritz-signature.png"
                  alt="Fritz Schroeder Signature"
                  className="h-16 w-auto object-contain absolute top-0 left-0"
                />
                <div className="absolute bottom-0 left-0 border-t border-slate-900 w-full pt-1">
                  <p className="font-bold text-xs text-slate-900 uppercase">Fritz Schroeder</p>
                  <p className="text-[10px] text-slate-600 font-medium">Services Manager (KZN)</p>
                  <p className="text-[9px] text-slate-500">Altek Green (Pty) Ltd</p>
                </div>
              </div>

              <div className="text-right text-[10px] text-slate-400 font-mono">
                <p>Generated: {format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
                <p>System: Altek Green AI Predictive Reliability Engine</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
