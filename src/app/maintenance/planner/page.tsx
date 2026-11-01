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
  ChevronLeft,
  ChevronRight, 
  Clock, 
  Wrench, 
  Check, 
  Send, 
  Layers, 
  Users, 
  UserCheck, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square,
  Edit3,
  FileCheck2,
  ArrowDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser, useMemoFirebase, useDoc } from '@/firebase';
import { collection, serverTimestamp, addDoc, query, where, getDocs, doc } from 'firebase/firestore';
import type { Breakdown, CompletedSchedule, DailyDiary, Equipment, User, FieldServiceReport, GeneratedReport } from '@/lib/types';
import { 
  generateMaintenancePlan, 
  type MaintenancePlanInput 
} from '@/ai/flows/generate-maintenance-plan-flow';
import {
  compileMaintenanceReportMarkdown,
  type MaintenanceTaskItem,
  type MaintenancePlanOutput
} from '@/lib/maintenance-planner-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { 
  format, 
  startOfWeek, 
  addDays, 
  addWeeks, 
  subDays, 
  startOfDay, 
  endOfDay, 
  getISOWeek 
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
  const stagingSectionRef = useRef<HTMLDivElement>(null);

  // User Profile
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);

  // 1. Target Week Calculation: STRICTLY MONDAY TO FRIDAY (Weekends Excluded)
  const initialTarget = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    // Default to upcoming week
    const targetBase = (day === 5 || day === 6 || day === 0) ? addWeeks(now, 1) : addWeeks(now, 1);
    const from = startOfWeek(targetBase, { weekStartsOn: 1 }); // Monday
    const to = addDays(from, 4); // Friday
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
  const [isCompiling, setIsCompiling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client Mandates & Custom Notes
  const [clientSuggestedWork, setClientSuggestedWork] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('full_plan');
  const [isCustomWeekOpen, setIsCustomWeekOpen] = useState(false);
  const [isCustomLookbackOpen, setIsCustomLookbackOpen] = useState(false);

  // Interactive Staging State (Editable Tasks before compiling report)
  const [stagingTasks, setStagingTasks] = useState<MaintenanceTaskItem[]>([]);
  const [structuredPlan, setStructuredPlan] = useState<MaintenancePlanOutput | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);

  // Computed Target Week details (Strictly Monday to Friday)
  const targetWeekNumber = useMemo(() => {
    if (!targetDateRange.from) return getISOWeek(new Date());
    return getISOWeek(targetDateRange.from);
  }, [targetDateRange]);

  const targetPeriodLabel = useMemo(() => {
    if (!targetDateRange.from) return 'Upcoming Week';
    const from = targetDateRange.from;
    const to = targetDateRange.to || addDays(from, 4);
    return `Week ${targetWeekNumber}: Monday ${format(from, 'dd MMM')} – Friday ${format(to, 'dd MMM yyyy')}`;
  }, [targetDateRange, targetWeekNumber]);

  // Presets
  const presets: PlannerPreset[] = useMemo(() => [
    {
      id: 'full_plan',
      title: 'Full Weekly Predictive Plan (Mon – Fri)',
      badge: 'Balanced Schedule',
      badgeVariant: 'default',
      description: 'Coordinates client-suggested work for Mon/Tue, allocates the 5-person crew, and schedules Altek PMs for the rest of the week.',
      promptDirective: 'Generate the complete Altek Green Weekly Predictive Maintenance Plan for Monday to Friday ONLY. Respect client-mandated work first with required multi-person crew sizes, then fill remaining team capacity for the rest of the week.',
    },
    {
      id: 'critical_components',
      title: 'Critical Equipment & Component Health Analysis',
      badge: 'High Risk Focus',
      badgeVariant: 'destructive',
      description: 'Prioritizes assets showing repeat trips (earth faults, IGBT overcurrent, capacitor degradation) and evaluates component failure risk.',
      promptDirective: 'Focus heavily on high-frequency breakdown equipment, repeat VSD trips, capacitor bank age, and motor insulation degradation. Provide a deeply detailed Priority Risk Matrix with explicit root causes, preventative testing, and required crew sizes for Monday to Friday.',
    },
    {
      id: 'local_mode_audit',
      title: 'Deferred Work & Local Mode / Bypass Audit',
      badge: 'Safety & Automation',
      badgeVariant: 'secondary',
      description: 'Identifies drives running on Local control, lost DeviceNet/PLC comms, temporary jumpers, or deferred FSR repairs.',
      promptDirective: 'Perform a dedicated audit of latent risks: identify drives running on Local mode without PLC automation, communication line dropouts, bypassed interlocks, and pending repair recommendations for the Monday-Friday work week.',
    },
    {
      id: 'vsd_pm_focus',
      title: 'VSD, Softstarter & MCC PM Overhauls',
      badge: 'Lifecycle PM',
      badgeVariant: 'outline',
      description: 'Schedules 3-monthly and 6-monthly VSD services, capacitor replacements, fan filter cleaning, and thermal imaging scans.',
      promptDirective: 'Prioritize routine lifecycle renewals: 3-monthly/6-monthly VSD servicing, capacitor renewals, blower fan inspections, busbar torquing, and MCC dust mitigation across MPE, MPC, MPD, MPA, and Smelter for Monday to Friday.',
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

    // Step target week forward or backward
  const handleStepWeek = (offset: number) => {
    const currentBase = targetDateRange.from || new Date();
    const newBase = addWeeks(currentBase, offset);
    const from = startOfWeek(newBase, { weekStartsOn: 1 }); // Monday
    const to = addDays(from, 4); // Friday
    setTargetDateRange({ from, to });
    toast({
      title: `Week ${getISOWeek(from)} Selected`,
      description: `Monday ${format(from, 'dd MMM')} – Friday ${format(to, 'dd MMM yyyy')}`,
    });
  };

  // Single date click in calendar: selects that date's entire Monday to Friday work week
  const handleSelectCustomWeekDate = (date: Date | undefined) => {
    if (!date) return;
    const from = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const to = addDays(from, 4); // Friday
    setTargetDateRange({ from, to });
    setIsCustomWeekOpen(false);
    toast({
      title: `Week ${getISOWeek(from)} Selected`,
      description: `Monday ${format(from, 'dd MMM')} – Friday ${format(to, 'dd MMM yyyy')}`,
    });
  };

  // Quick Target Week Select: Monday to Friday
  const handleTargetWeekOffset = (weekOffset: number) => {
    const now = new Date();
    const target = addWeeks(now, weekOffset);
    const from = startOfWeek(target, { weekStartsOn: 1 }); // Monday
    const to = addDays(from, 4); // Friday
    setTargetDateRange({ from, to });
  };

  // Fetch Lookback Data using exact Firestore collection names
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
      const fromISO = startOfDay(lookbackRange.from).toISOString();
      const toISO = endOfDay(lookbackRange.to).toISOString();

      // Query correct Firestore collections
      const newBreakdownsQuery = query(
        collection(firestore, 'breakdown_reports'),
        where('date', '>=', fromStr),
        where('date', '<=', toStr)
      );

      const closedBreakdownsQuery = query(
        collection(firestore, 'breakdown_reports'),
        where('resolved', '==', true),
        where('timeBackInService', '>=', fromISO),
        where('timeBackInService', '<=', toISO)
      );

      const schedulesQuery = query(
        collection(firestore, 'completed_schedules'),
        where('completionDate', '>=', fromStr),
        where('completionDate', '<=', toStr)
      );

      const diariesQuery = query(
        collection(firestore, 'daily_diaries'),
        where('date', '>=', fromStr),
        where('date', '<=', toStr)
      );

      const fsrQuery = query(
        collection(firestore, 'field_service_reports'),
        where('date', '>=', fromStr),
        where('date', '<=', toStr)
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

      const fetchedData: AggregatedLookbackData = {
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

      toast({
        title: 'Diagnostic Data Loaded',
        description: `Loaded ${fetchedData.fieldServiceReports.length} FSRs, ${fetchedData.dailyDiaries.length} Diaries, and ${fetchedData.newBreakdowns.length + fetchedData.closedBreakdowns.length} Breakdowns.`,
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

  // Execute AI Maintenance Plan Analysis -> Populates Staging Area
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
        targetEndDate: format(targetDateRange.to, 'yyyy-MM-dd'), // Friday
        clientSuggestedWork: clientSuggestedWork.trim() || undefined,
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

      setStructuredPlan(result.data.structured);
      setStagingTasks(result.data.structured.proposedTasks || []);
      setGeneratedPlan(result.data.compiledMarkdown);

      toast({ 
        title: 'Work Orders Staged', 
        description: `${(result.data.structured.proposedTasks || []).length} tasks staged for Monday to Friday. Review and edit below.` 
      });

      // Smooth scroll to staging section
      setTimeout(() => {
        stagingSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);

    } catch (e: any) {
      console.error('Plan Generation Error:', e);
      setError(e.message || 'An error occurred during generation.');
      toast({ variant: 'destructive', title: 'Generation Failed', description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  // Compile Final Markdown from Staging Area
  const handleCompileReport = async () => {
    if (!structuredPlan) {
      toast({ variant: 'destructive', title: 'No Plan Data', description: 'Please generate a plan draft first.' });
      return;
    }

    setIsCompiling(true);
    try {
      const activeTasks = stagingTasks.filter(t => t.included !== false);
      if (activeTasks.length === 0) {
        toast({ variant: 'destructive', title: 'No Tasks Ticked', description: 'Please tick at least one task to include in the report.' });
        setIsCompiling(false);
        return;
      }

      const compiled = await compileMaintenanceReportMarkdown({
        targetWeek: targetWeekNumber,
        targetStartDate: format(targetDateRange.from!, 'yyyy-MM-dd'),
        targetEndDate: format(targetDateRange.to!, 'yyyy-MM-dd'),
        lookbackStartDate: format(lookbackRange.from!, 'yyyy-MM-dd'),
        lookbackEndDate: format(lookbackRange.to!, 'yyyy-MM-dd'),
        overview: structuredPlan.overview,
        clientSection: structuredPlan.clientSection,
        riskMatrix: structuredPlan.riskMatrix,
        tasks: stagingTasks,
        latentIssues: structuredPlan.latentIssues,
        sparesRequirements: structuredPlan.sparesRequirements,
        safetyProtocols: structuredPlan.safetyProtocols,
      });

      setGeneratedPlan(compiled);
      toast({ title: 'Report Compiled', description: `Formal Weekly Maintenance Report updated with ${activeTasks.length} work orders.` });

      setTimeout(() => {
        reportContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (e: any) {
      console.error('Compilation Error:', e);
      toast({ variant: 'destructive', title: 'Compile Error', description: e.message });
    } finally {
      setIsCompiling(false);
    }
  };

  // Interactive Staging Handlers
  const handleToggleTask = (id: string) => {
    setStagingTasks(prev => prev.map(t => t.id === id ? { ...t, included: !t.included } : t));
  };

  const handleUpdateTaskField = (id: string, field: keyof MaintenanceTaskItem, value: any) => {
    setStagingTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleDeleteTask = (id: string) => {
    setStagingTasks(prev => prev.filter(t => t.id !== id));
    toast({ title: 'Task Removed' });
  };

  const handleAddTask = () => {
    const newTask: MaintenanceTaskItem = {
      id: `custom-task-${Date.now()}`,
      day: 'Monday',
      origin: 'Altek Predictive / PM',
      site: 'MPE',
      asset: 'New Equipment / Drive',
      scope: 'Inspect and perform diagnostic checks.',
      priority: 'P2 - HIGH',
      crewAllocation: 'Pair (2 Techs): David Msane & Buyani Mthembu',
      included: true,
    };
    setStagingTasks(prev => [...prev, newTask]);
    toast({ title: 'New Task Added', description: 'Fill in the scope and details in the table below.' });
  };

  const handleToggleAll = (included: boolean) => {
    setStagingTasks(prev => prev.map(t => ({ ...t, included })));
  };

  // Copy Markdown
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
          text: `Please find the Altek Green Weekly Maintenance Plan for Week ${targetWeekNumber} (${format(targetDateRange.from!, 'dd MMM')} – ${format(targetDateRange.to!, 'dd MMM yyyy')}).`,
        });
        toast({ title: 'Shared Successfully' });
      } else {
        pdf.save(fileName);
        toast({
          title: 'PDF Downloaded',
          description: 'Direct browser file sharing is unavailable. The PDF has been downloaded—opening WhatsApp so you can attach it.',
        });

        const shareMsg = encodeURIComponent(
          `*Altek Green - Weekly Maintenance Plan*\n` +
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
    const cleanSnippet = generatedPlan.slice(0, 1500).replace(/#/g, '').trim();
    const text = encodeURIComponent(
      `*Altek Green Maintenance Plan (Week ${targetWeekNumber})*\n` +
      `*Period:* ${format(targetDateRange.from!, 'dd MMM')} – ${format(targetDateRange.to!, 'dd MMM yyyy')} (Mon–Fri)\n` +
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
        clientSuggestedWork: clientSuggestedWork.trim() || null,
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

  const totalTickedTasks = useMemo(() => stagingTasks.filter(t => t.included !== false).length, [stagingTasks]);

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
              Monday – Friday Work Program
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Formulate balanced weekly work orders, risk matrices, and multi-technician allocations (strictly excluding weekends).
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

      {/* Team Resource Capacity Notice */}
      <div className="bg-slate-900 text-slate-100 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm print-hidden border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-md text-emerald-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Field Crew Capacity: Strict 5-Technician Pool (Monday – Friday Only)
            </h4>
            <p className="text-[11px] text-slate-300">
              Saturdays & Sundays are excluded. Daily maximum of 5 technicians across all tasks (Full Team of 5 for major shuts, pairs for routine MCCs).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">Full Team (5)</span>
          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">Crew (3)</span>
          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">Pair (2)</span>
          <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">Solo (1)</span>
        </div>
      </div>

      {/* Control Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print-hidden">
        {/* Step 1: Target Week Selection (Strictly Monday - Friday) */}
        <Card className="lg:col-span-5 border-emerald-100 shadow-sm">
          <CardHeader className="pb-3 bg-emerald-50/40 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-emerald-950">
                <CalendarIcon className="h-4 w-4 text-emerald-600" />
                1. Target Maintenance Week (Mon – Fri)
              </CardTitle>
              <Badge variant="outline" className="font-mono text-xs bg-white text-emerald-800 border-emerald-200">
                Week {targetWeekNumber}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Schedules are strictly Monday to Friday. Weekends are not scheduled.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs bg-white h-8 px-2.5 hover:bg-slate-50 border-slate-300"
                onClick={() => handleStepWeek(-1)}
                title="Previous Week"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Prev
              </Button>
              <Button
                type="button"
                size="sm"
                variant={targetDateRange.from && getISOWeek(targetDateRange.from) === getISOWeek(new Date()) ? 'default' : 'outline'}
                className={targetDateRange.from && getISOWeek(targetDateRange.from) === getISOWeek(new Date()) ? 'bg-emerald-600 hover:bg-emerald-700 text-xs h-8 text-white' : 'text-xs bg-white h-8 border-slate-300'}
                onClick={() => handleTargetWeekOffset(0)}
              >
                Current (W{getISOWeek(new Date())})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={targetDateRange.from && getISOWeek(targetDateRange.from) === getISOWeek(addWeeks(new Date(), 1)) ? 'default' : 'outline'}
                className={targetDateRange.from && getISOWeek(targetDateRange.from) === getISOWeek(addWeeks(new Date(), 1)) ? 'bg-emerald-600 hover:bg-emerald-700 text-xs h-8 text-white' : 'text-xs bg-white h-8 border-slate-300'}
                onClick={() => handleTargetWeekOffset(1)}
              >
                Next Week (W{getISOWeek(addWeeks(new Date(), 1))})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs bg-white h-8 px-2.5 hover:bg-slate-50 border-slate-300"
                onClick={() => handleStepWeek(1)}
                title="Next Week"
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>

            <div className="border rounded-md p-3 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Work Program Window (Mon – Fri):</p>
                <p className="text-sm font-bold text-slate-800">
                  {targetPeriodLabel}
                </p>
              </div>
              <Popover open={isCustomWeekOpen} onOpenChange={setIsCustomWeekOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="bg-white text-xs border-slate-300 font-medium hover:bg-slate-100 shadow-sm">
                    <CalendarIcon className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                    Custom Week
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="end">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-800 border-b pb-1.5">
                      Click any date to select its Monday–Friday work week:
                    </div>
                    <Calendar
                      weekStartsOn={1}
                      initialFocus
                      mode="single"
                      defaultMonth={targetDateRange.from}
                      selected={targetDateRange.from}
                      onSelect={handleSelectCustomWeekDate}
                      numberOfMonths={1}
                    />
                  </div>
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

              <Popover open={isCustomLookbackOpen} onOpenChange={setIsCustomLookbackOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs bg-white border-slate-300">
                    <CalendarIcon className="mr-1 h-3.5 w-3.5 text-blue-600" />
                    Custom Dates
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    weekStartsOn={1}
                    initialFocus
                    mode="range"
                    defaultMonth={lookbackRange.from}
                    selected={lookbackRange}
                    onSelect={(range) => {
                      if (range?.from) {
                        const from = range.from;
                        const to = range.to || range.from;
                        setLookbackRange({ from, to });
                        setLookbackDays(Math.round(Math.abs(to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
                        if (range.to) {
                          setIsCustomLookbackOpen(false);
                        }
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

        {/* Step 3: Client Mandated / Suggested Work (Priority Directives) */}
        <Card className="lg:col-span-12 border-blue-200 shadow-sm bg-gradient-to-br from-blue-50/40 via-white to-white">
          <CardHeader className="pb-3 bg-blue-50/70 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-blue-950">
                <UserCheck className="h-4 w-4 text-blue-600" />
                3. Client Mandated / Suggested Work (Priority Directives)
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-normal text-xs">
                Priority #1 Lock-In
              </Badge>
            </div>
            <CardDescription className="text-xs text-blue-900/80">
              Specify work requested or suggested by the client (e.g., Monday & Tuesday shuts or breakdowns). The AI will lock these in first with the required team size, then plan the rest of the week for Altek Green preventative maintenance.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Quick Suggestions:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs bg-white text-slate-700 border-slate-300 hover:bg-blue-50"
                onClick={() => setClientSuggestedWork('Monday: Full 5-man team on Smelter West Crane Drive testing and commissioning shut.\nTuesday: 2 technicians on MPE Tails Pump capacitor change.')}
              >
                Mon (Full Team Shut) + Tue (Pair)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs bg-white text-slate-700 border-slate-300 hover:bg-blue-50"
                onClick={() => setClientSuggestedWork('Monday & Tuesday: 3 technicians on Roaster Plant MCC2 VSD 3-monthly maintenance. Client requested Altek Green to plan Wednesday to Friday.')}
              >
                Mon–Tue 3-Man Roaster PM
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs bg-white text-slate-700 border-slate-300 hover:bg-blue-50"
                onClick={() => setClientSuggestedWork('Monday: 2 technicians on Smelter S30 Vibrator Feeder DeviceNet PLC comms restoration.\nTuesday: Client shut on MPD Dredger MCC.')}
              >
                DeviceNet Comms + Dredger Shut
              </Button>
              {clientSuggestedWork && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-500 hover:text-red-600"
                  onClick={() => setClientSuggestedWork('')}
                >
                  Clear
                </Button>
              )}
            </div>

            <textarea
              value={clientSuggestedWork}
              onChange={(e) => setClientSuggestedWork(e.target.value)}
              placeholder="Example: Client requested that on Monday the entire 5-man team attends the Smelter West Crane shut. On Tuesday, 2 technicians attend the MPE Tails Pump. What is the plan for Wednesday to Friday?"
              rows={3}
              className="w-full text-xs p-3 rounded-md border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-sans bg-white shadow-inner"
            />
          </CardContent>
        </Card>

        {/* Step 4: Predictive Planning Presets & Managerial Focus */}
        <Card className="lg:col-span-12 border-slate-200 shadow-sm">
          <CardHeader className="pb-3 bg-slate-50/70 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-900">
              <Layers className="h-4 w-4 text-emerald-600" />
              4. Planning Focus & Predictive Templates
            </CardTitle>
            <CardDescription className="text-xs">
              Choose an engineering objective or customize priority equipment for the remaining days of the work week.
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
                Services Manager Notes / Specific Spares & Allocations (Optional):
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Example: Ensure David Msane leads the VSD capacitor team and Buyani Mthembu oversees cable insulation testing at MPE."
                rows={2}
                className="w-full text-xs p-2.5 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono bg-white"
              />
            </div>

            {/* Generate Button Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t">
              <div className="text-xs text-slate-500">
                Planning for <strong className="text-slate-800">Week {targetWeekNumber}</strong> (Monday–Friday, 5 Technicians) using <strong className="text-slate-800">{lookbackDays}-day</strong> history.
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
                    Generating Proposed Work Orders...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Proposed Work Orders
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

      {/* EDITABLE STAGING AREA (Review, Tick, and Edit before compiling report) */}
      {stagingTasks.length > 0 && (
        <div ref={stagingSectionRef} className="space-y-4 pt-2 print-hidden">
          <Card className="border-amber-300 shadow-md bg-gradient-to-br from-amber-50/30 via-white to-white">
            <CardHeader className="py-3 px-4 bg-amber-50/60 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-amber-700" />
                  <CardTitle className="text-base font-bold text-amber-950">
                    Editable Staged Work Orders (Monday – Friday)
                  </CardTitle>
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs">
                    {totalTickedTasks} of {stagingTasks.length} Ticked
                  </Badge>
                </div>
                <CardDescription className="text-xs text-amber-900/80 mt-0.5">
                  Tick to include tasks, or manually adjust Day, Site, Asset, Scope of Work, and Crew before compiling the final formal report.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleAll(true)}
                  className="bg-white text-xs"
                >
                  <CheckSquare className="mr-1 h-3.5 w-3.5" /> Tick All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleAll(false)}
                  className="bg-white text-xs"
                >
                  <Square className="mr-1 h-3.5 w-3.5" /> Untick All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTask}
                  className="bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50 text-xs font-semibold"
                >
                  <Plus className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Add Task
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCompileReport}
                  disabled={isCompiling}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
                >
                  {isCompiling ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <FileCheck2 className="mr-1.5 h-4 w-4" />
                  )}
                  Compile Final Report ({totalTickedTasks})
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b text-slate-800 font-semibold">
                    <th className="p-2.5 w-10 text-center">Include</th>
                    <th className="p-2.5 w-28">Day (Mon-Fri)</th>
                    <th className="p-2.5 w-32">Origin / Type</th>
                    <th className="p-2.5 w-24">Site</th>
                    <th className="p-2.5 w-44">Equipment / Asset / Drive</th>
                    <th className="p-2.5 min-w-[240px]">Scope of Work (Editable)</th>
                    <th className="p-2.5 w-32">Priority</th>
                    <th className="p-2.5 w-48">Crew Size & Names</th>
                    <th className="p-2.5 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {stagingTasks.map((task) => (
                    <tr
                      key={task.id}
                      className={cn(
                        'transition-colors',
                        task.included !== false
                          ? 'bg-white hover:bg-slate-50/60'
                          : 'bg-slate-50/80 opacity-60 text-slate-400'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="p-2.5 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={task.included !== false}
                          onChange={() => handleToggleTask(task.id!)}
                          className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Day Selector (Mon-Fri ONLY) */}
                      <td className="p-2.5 align-top">
                        <select
                          value={task.day}
                          onChange={(e) => handleUpdateTaskField(task.id!, 'day', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white font-medium focus:ring-emerald-500"
                        >
                          <option value="Monday">Monday</option>
                          <option value="Tuesday">Tuesday</option>
                          <option value="Wednesday">Wednesday</option>
                          <option value="Thursday">Thursday</option>
                          <option value="Friday">Friday</option>
                        </select>
                      </td>

                      {/* Origin Selector */}
                      <td className="p-2.5 align-top">
                        <select
                          value={task.origin}
                          onChange={(e) => handleUpdateTaskField(task.id!, 'origin', e.target.value)}
                          className={cn(
                            'w-full text-[11px] p-1.5 rounded border font-semibold',
                            task.origin === 'Client Mandate'
                              ? 'bg-blue-50 text-blue-800 border-blue-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          )}
                        >
                          <option value="Client Mandate">Client Mandate</option>
                          <option value="Altek Predictive / PM">Altek Predictive / PM</option>
                        </select>
                      </td>

                      {/* Site */}
                      <td className="p-2.5 align-top">
                        <input
                          type="text"
                          value={task.site}
                          onChange={(e) => handleUpdateTaskField(task.id!, 'site', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white font-medium"
                          placeholder="Site (e.g. MPE)"
                        />
                      </td>

                      {/* Equipment / Asset / Drive */}
                      <td className="p-2.5 align-top">
                        <input
                          type="text"
                          value={task.asset}
                          onChange={(e) => handleUpdateTaskField(task.id!, 'asset', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white font-semibold text-slate-900"
                          placeholder="Asset / Drive Name"
                        />
                      </td>

                      {/* Scope of Work (Editable) */}
                      <td className="p-2.5 align-top">
                        <textarea
                          rows={2}
                          value={task.scope}
                          onChange={(e) => handleUpdateTaskField(task.id!, 'scope', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white font-sans focus:ring-emerald-500"
                          placeholder="Describe the scope of work, diagnostics, or parts to replace"
                        />
                      </td>

                      {/* Priority */}
                      <td className="p-2.5 align-top">
                        <select
                          value={task.priority}
                          onChange={(e) => handleUpdateTaskField(task.id!, 'priority', e.target.value)}
                          className="w-full text-[11px] p-1.5 rounded border border-slate-300 bg-white"
                        >
                          <option value="P1 - CRITICAL">P1 - CRITICAL</option>
                          <option value="P2 - HIGH">P2 - HIGH</option>
                          <option value="P3 - MEDIUM">P3 - MEDIUM</option>
                          <option value="P4 - ROUTINE">P4 - ROUTINE</option>
                        </select>
                      </td>

                      {/* Crew Allocation */}
                      <td className="p-2.5 align-top">
                        <input
                          type="text"
                          value={task.crewAllocation}
                          onChange={(e) => handleUpdateTaskField(task.id!, 'crewAllocation', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white font-mono text-[11px]"
                          placeholder="e.g. Pair (2 Techs): David & Buyani"
                        />
                      </td>

                      {/* Delete */}
                      <td className="p-2.5 text-center align-middle">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTask(task.id!)}
                          className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Bottom Compilation Trigger */}
              <div className="p-3 bg-amber-50/50 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="text-xs text-amber-900">
                  Ready to finalize? Click <strong>Compile Final Report</strong> to generate the official document with your chosen work orders.
                </div>
                <Button
                  size="default"
                  onClick={handleCompileReport}
                  disabled={isCompiling}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                >
                  {isCompiling ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <FileCheck2 className="mr-1.5 h-4 w-4" />
                  )}
                  Compile Final Report ({totalTickedTasks} Work Orders Ticked)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FINAL COMPILED REPORT SECTION */}
      {generatedPlan && (
        <div ref={reportContainerRef} className="space-y-4 pt-4">
          {/* Top Action Bar (Print to PDF, WhatsApp, Copy, Save) */}
          <Card className="border-emerald-200 bg-white shadow-sm print-hidden">
            <CardHeader className="py-3 px-4 bg-emerald-50/50 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-700" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Compiled Weekly Maintenance Report (Week {targetWeekNumber}: Mon – Fri)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {clientSuggestedWork ? 'Coordinated Client Mandates & Altek Green Preventative Schedule.' : 'Proactive Preventative Maintenance & Multi-Technician Allocations.'}
                  </p>
                </div>
              </div>

              {/* ACTION BUTTONS */}
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

                {/* Export to WhatsApp */}
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

                {/* Edit Tasks Button (Scroll back up to staging) */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => stagingSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-amber-800 border-amber-300 hover:bg-amber-50 text-xs"
                >
                  <Edit3 className="mr-1 h-3.5 w-3.5 text-amber-600" />
                  Edit Tasks
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
