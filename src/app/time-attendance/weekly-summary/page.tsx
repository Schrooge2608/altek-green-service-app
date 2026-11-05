'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCollection,
  useFirebase,
  useMemoFirebase,
  useUser,
  useDoc
} from '@/firebase';
import { collection, query, where, doc, getDoc, setDoc, orderBy } from 'firebase/firestore';
import type { Timesheet, TimesheetEntry, User, StandbyShift } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { format, addDays, getDay, isSunday, isSaturday, parseISO } from 'date-fns';
import { 
  Printer, 
  Share2, 
  Save, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  User as UserIcon, 
  Loader2, 
  CheckCircle2, 
  ArrowLeft,
  Clock,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AltekLogo } from '@/components/altek-logo';
import Link from 'next/link';

// Helpers for cross-midnight math
const getDuration = (startStr?: string, endStr?: string) => {
  if (!startStr || !endStr || startStr === '--:--' || endStr === '--:--' || startStr.trim() === '') return 0;
  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  if (isNaN(sH) || isNaN(eH)) return 0;
  let start = sH + ((sM || 0) / 60);
  let end = eH + ((eM || 0) / 60);
  if (end < start) end += 24; 
  return end - start;
};

// Calculates Monday of given date
function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Generates week options starting with Monday (past 16 weeks to future 4 weeks)
function generateWeekOptions() {
  const options = [];
  const currentMonday = getMondayOfWeek(new Date());

  for (let i = 4; i >= -16; i--) {
    const monday = addDays(currentMonday, i * 7);
    const sunday = addDays(monday, 6);
    const val = format(monday, 'yyyy-MM-dd');
    options.push({
      value: val,
      monday,
      sunday,
      label: `${format(monday, 'EEE dd MMM yyyy')} – ${format(sunday, 'dd MMM yyyy')}`,
      displayHeader: format(monday, 'EEE dd MMM yyyy'),
      isCurrent: val === format(currentMonday, 'yyyy-MM-dd')
    });
  }
  return options;
}

export interface WeeklyRowData {
  date: string;              // '2026-11-16'
  displayDate: string;       // '16 Nov'
  dayName: string;           // 'Mon', 'Tue'...
  dayIndex: number;          // 1=Mon, 2=Tue... 0=Sun
  status: string;            // 'Present', 'Sick (with note)', 'Absent', 'Leave', 'Weekend'
  isStandby: boolean;        // true/false
  startTime: string;         // '07:00'
  endTime: string;           // '16:00'
  ntHours: number;           // 8.5
  overtimeHours: number;     // total OT
  ot10Hours: number;         // OT 1.0 (or 1.5)
  dt20Hours: number;         // DT 2.0
  jobDescription: string;    // 'VSD maintenance roaster MCC'
  signature?: string | null;
}

export default function WeeklyTimesheetSummaryPage() {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const weekOptions = useMemo(() => generateWeekOptions(), []);
  const initialMonday = useMemo(() => format(getMondayOfWeek(new Date()), 'yyyy-MM-dd'), []);

  const [selectedMondayStr, setSelectedMondayStr] = useState<string>(initialMonday);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [tableRows, setTableRows] = useState<WeeklyRowData[]>([]);

  // Current logged in user info
  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: currentUserData, isLoading: currentUserLoading } = useDoc<User>(userRef);

  const isManagement = useMemo(() => {
    if (!currentUserData?.role) return false;
    const managementRoles = ['Admin', 'Superadmin', 'Client Manager', 'Corporate Manager', 'Services Manager', 'Data Admin', 'Site Supervisor'];
    return managementRoles.some(role => currentUserData.role.includes(role));
  }, [currentUserData]);

  // All users to populate technician dropdown
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  // Standby shifts to determine Standby Yes/No
  const standbyQuery = useMemoFirebase(
    () => query(collection(firestore, 'standby_shifts'), orderBy('startDate', 'asc')),
    [firestore]
  );
  const { data: standbyShifts } = useCollection<StandbyShift>(standbyQuery);

  // Technicians list
  const technicians = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.role !== 'Client' && 
      u.role !== 'Client Manager' && 
      (u.role?.includes('Technician') || 
       u.role?.includes('Engineer') || 
       u.role?.includes('Technologist') ||
       u.role?.includes('Specialist') ||
       u.timesheetEnabled === true ||
       !u.role)
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allUsers]);

  // Auto-select technician
  useEffect(() => {
    if (!selectedUserId && user) {
      if (isManagement) {
        // If admin, default to first tech or current user if in list
        const defaultTech = technicians.find(t => t.id === user.uid) || technicians[0];
        if (defaultTech) setSelectedUserId(defaultTech.id);
      } else {
        setSelectedUserId(user.uid);
      }
    }
  }, [selectedUserId, user, isManagement, technicians]);

  const selectedTechnician = useMemo(() => {
    return technicians.find(t => t.id === selectedUserId) || allUsers?.find(u => u.id === selectedUserId) || null;
  }, [technicians, allUsers, selectedUserId]);

  const selectedTechName = selectedTechnician?.name || 'Technician';

  // Compute the 7 dates of the selected week (Monday -> Sunday)
  const currentWeekDates = useMemo(() => {
    const monday = new Date(`${selectedMondayStr}T00:00:00`);
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(monday, i));
    }
    return dates;
  }, [selectedMondayStr]);

  // Months covered by this week (e.g. ['2026-11'] or ['2026-10', '2026-11'])
  const relevantPeriods = useMemo(() => {
    const periods = new Set<string>();
    currentWeekDates.forEach(d => {
      periods.add(format(d, 'yyyy-MM'));
    });
    return Array.from(periods);
  }, [currentWeekDates]);

  // Query timesheets for this user across relevant months
  const timesheetsQuery = useMemoFirebase(() => {
    if (!selectedUserId || relevantPeriods.length === 0) return null;
    return query(
      collection(firestore, 'timesheets'),
      where('userId', '==', selectedUserId),
      where('period', 'in', relevantPeriods)
    );
  }, [firestore, selectedUserId, relevantPeriods]);

  const { data: userTimesheets, isLoading: timesheetsLoading } = useCollection<Timesheet>(timesheetsQuery);

  // Rebuild the 7 rows whenever timesheets, week, tech, or standby shifts change
  useEffect(() => {
    if (!currentWeekDates || currentWeekDates.length !== 7) return;

    // Combine all entries across months
    const allEntriesMap = new Map<string, TimesheetEntry>();
    if (userTimesheets) {
      userTimesheets.forEach(ts => {
        if (ts.entries && Array.isArray(ts.entries)) {
          ts.entries.forEach(e => {
            if (e.date) allEntriesMap.set(e.date, e);
          });
        }
      });
    }

    // Check standby qualification for this technician
    const techNameClean = selectedTechName.replace(/\s+/g, ' ').trim().toLowerCase();
    const isTechOnStandbyDate = (dateStr: string) => {
      if (!standbyShifts) return false;
      const targetDate = new Date(`${dateStr}T12:00:00`);
      return standbyShifts.some(shift => {
        const prim = (shift.primaryTech || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const back = (shift.backupTech || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (prim !== techNameClean && back !== techNameClean) return false;
        const start = new Date(`${shift.startDate}T00:00:00`);
        const end = new Date(`${shift.endDate}T23:59:59`);
        return targetDate >= start && targetDate <= end;
      });
    };

    const newRows: WeeklyRowData[] = currentWeekDates.map((dayDate) => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const displayDate = format(dayDate, 'dd MMM');
      const dayName = format(dayDate, 'EEE');
      const dayOfWeek = dayDate.getDay(); // 1=Mon, 2=Tue... 5=Fri, 6=Sat, 0=Sun
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isFriday = dayOfWeek === 5;
      const isStandby = isTechOnStandbyDate(dateStr);

      const entry = allEntriesMap.get(dateStr);

      // Default start/end times
      let start = entry?.normalIn || '';
      let end = entry?.normalOut || '';
      
      // Auto-suggest standard working hours on weekdays if user clocked or present
      if (!start && !end && !isWeekend && entry?.comments) {
        start = '07:00';
        end = isFriday ? '13:30' : '16:00';
      }

      // Compute durations
      let grossShift = getDuration(start, end);
      let lunchBreak = getDuration(entry?.lunchOut, entry?.lunchIn);
      let calloutDuration = getDuration(entry?.calloutIn, entry?.calloutOut);

      if (!isWeekend && grossShift >= 6 && lunchBreak === 0) {
        lunchBreak = 0.5;
      }

      let netNormalShift = Math.max(0, grossShift - lunchBreak);
      let nt = 0;
      let ot10 = 0;
      let dt20 = 0;

      if (dayOfWeek === 0) {
        // Sunday: Double Time (2.0x)
        dt20 = netNormalShift + calloutDuration;
      } else if (dayOfWeek === 6) {
        // Saturday: Overtime 1.5x (OT 1.0)
        ot10 = netNormalShift + calloutDuration;
      } else if (isFriday) {
        // Friday: Normal 6.0 hrs
        nt = Math.min(netNormalShift, 6.0);
        ot10 = Math.max(0, netNormalShift - 6.0) + calloutDuration;
      } else {
        // Mon - Thu: Normal 8.5 hrs
        nt = Math.min(netNormalShift, 8.5);
        ot10 = Math.max(0, netNormalShift - 8.5) + calloutDuration;
      }

      // If entry had explicit calculated fields from timesheet, respect them if present
      if (entry?.calculatedNT !== undefined && grossShift === 0 && entry.calculatedNT > 0) {
        nt = entry.calculatedNT;
      }
      if (entry?.calculatedOT15 !== undefined && ot10 === 0 && entry.calculatedOT15 > 0) {
        ot10 = entry.calculatedOT15;
      }
      if (entry?.calculatedOT20 !== undefined && dt20 === 0 && entry.calculatedOT20 > 0) {
        dt20 = entry.calculatedOT20;
      }

      // Status determination
      let status = '';
      if (entry?.comments?.toLowerCase().includes('sick')) {
        status = 'Sick (with note)';
      } else if (entry?.comments?.toLowerCase().includes('leave')) {
        status = 'Leave / Holiday';
      } else if (entry?.comments?.toLowerCase().includes('absent')) {
        status = 'Absent - Unpaid';
      } else if (nt > 0 || ot10 > 0 || dt20 > 0) {
        status = isWeekend ? 'Call-Out / OT' : 'Present';
      } else if (isStandby && isWeekend) {
        status = 'Standby';
      }

      const totalOT = Number((ot10 + dt20).toFixed(1));

      return {
        date: dateStr,
        displayDate,
        dayName,
        dayIndex: dayOfWeek,
        status,
        isStandby,
        startTime: start,
        endTime: end,
        ntHours: Number(nt.toFixed(1)),
        overtimeHours: totalOT,
        ot10Hours: Number(ot10.toFixed(1)),
        dt20Hours: Number(dt20.toFixed(1)),
        jobDescription: entry?.comments || entry?.overtimeReason || '',
        signature: entry?.signature || null
      };
    });

    setTableRows(newRows);
  }, [currentWeekDates, userTimesheets, standbyShifts, selectedTechName]);

  // Handle cell edit
  const handleUpdateRow = (index: number, field: keyof WeeklyRowData, value: any) => {
    setTableRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      // If times changed, recalculate hours
      if (field === 'startTime' || field === 'endTime') {
        const isWeekend = row.dayIndex === 0 || row.dayIndex === 6;
        const isFriday = row.dayIndex === 5;
        let gross = getDuration(row.startTime, row.endTime);
        let lunch = (!isWeekend && gross >= 6) ? 0.5 : 0;
        let net = Math.max(0, gross - lunch);

        if (row.dayIndex === 0) {
          row.ntHours = 0;
          row.ot10Hours = 0;
          row.dt20Hours = Number(net.toFixed(1));
        } else if (row.dayIndex === 6) {
          row.ntHours = 0;
          row.ot10Hours = Number(net.toFixed(1));
          row.dt20Hours = 0;
        } else if (isFriday) {
          row.ntHours = Number(Math.min(net, 6.0).toFixed(1));
          row.ot10Hours = Number(Math.max(0, net - 6.0).toFixed(1));
          row.dt20Hours = 0;
        } else {
          row.ntHours = Number(Math.min(net, 8.5).toFixed(1));
          row.ot10Hours = Number(Math.max(0, net - 8.5).toFixed(1));
          row.dt20Hours = 0;
        }

        row.overtimeHours = Number((row.ot10Hours + row.dt20Hours).toFixed(1));
        if (!row.status && (row.ntHours > 0 || row.overtimeHours > 0)) {
          row.status = isWeekend ? 'Call-Out / OT' : 'Present';
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  // Weekly Totals
  const totals = useMemo(() => {
    let nt = 0;
    let ot10 = 0;
    let dt20 = 0;
    let totalOt = 0;
    let standbyDays = 0;
    let sickDays = 0;
    let absentDays = 0;

    tableRows.forEach(r => {
      nt += Number(r.ntHours || 0);
      ot10 += Number(r.ot10Hours || 0);
      dt20 += Number(r.dt20Hours || 0);
      totalOt += Number(r.overtimeHours || 0);
      if (r.isStandby) standbyDays += 1;
      if (r.status.toLowerCase().includes('sick')) sickDays += 1;
      if (r.status.toLowerCase().includes('absent')) absentDays += 1;
    });

    const ntRequired = 40.0;
    const ntShort = Math.max(0, Number((ntRequired - nt).toFixed(1)));
    const isNtMet = nt >= ntRequired;

    return {
      nt: Number(nt.toFixed(1)),
      ot10: Number(ot10.toFixed(1)),
      dt20: Number(dt20.toFixed(1)),
      totalOt: Number(totalOt.toFixed(1)),
      standbyDays,
      sickDays,
      absentDays,
      ntRequired,
      ntShort,
      isNtMet
    };
  }, [tableRows]);

  // Stepper controls
  const handlePrevWeek = () => {
    const curIndex = weekOptions.findIndex(w => w.value === selectedMondayStr);
    if (curIndex !== -1 && curIndex < weekOptions.length - 1) {
      setSelectedMondayStr(weekOptions[curIndex + 1].value);
    }
  };

  const handleNextWeek = () => {
    const curIndex = weekOptions.findIndex(w => w.value === selectedMondayStr);
    if (curIndex > 0) {
      setSelectedMondayStr(weekOptions[curIndex - 1].value);
    }
  };

  const handleCurrentWeek = () => {
    setSelectedMondayStr(initialMonday);
  };

  // Save changes back to Firestore
  const handleSaveToFirestore = async () => {
    if (!firestore || !selectedUserId || tableRows.length === 0) return;
    setIsSaving(true);

    try {
      // Group rows by period (YYYY-MM)
      const periodMap = new Map<string, WeeklyRowData[]>();
      tableRows.forEach(r => {
        const p = r.date.slice(0, 7);
        if (!periodMap.has(p)) periodMap.set(p, []);
        periodMap.get(p)!.push(r);
      });

      for (const [period, rows] of Array.from(periodMap.entries())) {
        const tsDocId = `${selectedUserId}_${period}`;
        const tsDocRef = doc(firestore, 'timesheets', tsDocId);
        const existingSnap = await getDoc(tsDocRef);

        let entries: TimesheetEntry[] = [];
        if (existingSnap.exists()) {
          const data = existingSnap.data() as Timesheet;
          entries = data.entries || [];
        }

        // Merge updated rows
        rows.forEach(r => {
          const existingIdx = entries.findIndex(e => e.date === r.date);
          const updatedEntry: TimesheetEntry = {
            date: r.date,
            normalIn: r.startTime,
            normalOut: r.endTime,
            calculatedNT: r.ntHours,
            calculatedOT15: r.ot10Hours,
            calculatedOT20: r.dt20Hours,
            comments: r.jobDescription || r.status,
            signature: r.signature || (existingIdx !== -1 ? entries[existingIdx].signature : null),
          };

          if (existingIdx !== -1) {
            entries[existingIdx] = { ...entries[existingIdx], ...updatedEntry };
          } else {
            entries.push(updatedEntry);
          }
        });

        // Save
        await setDoc(tsDocRef, {
          id: tsDocId,
          userId: selectedUserId,
          userName: selectedTechName,
          period: period,
          entries: entries,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      toast({
        title: 'Weekly Timesheet Saved',
        description: `Successfully saved weekly entries for ${selectedTechName}.`,
      });
    } catch (err: any) {
      console.error('Error saving weekly timesheet:', err);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: err.message || 'Could not save timesheet to Firestore.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // WhatsApp share
  const handleExportWhatsApp = () => {
    const lines: string[] = [
      `*ALTEK GREEN WEEKLY TIMESHEET*`,
      `*Technician:* ${selectedTechName}`,
      `*Week Starting:* ${format(new Date(`${selectedMondayStr}T00:00:00`), 'EEE dd MMM yyyy')}`,
      `-----------------------------------------`,
      ...tableRows.map(r => 
        `• *${r.dayName} ${r.displayDate}*: ${r.status || 'Normal'} | NT: ${r.ntHours}h | OT: ${r.overtimeHours}h | DT: ${r.dt20Hours}h ${r.isStandby ? '[Standby]' : ''}${r.jobDescription ? `\n  _${r.jobDescription}_` : ''}`
      ),
      `-----------------------------------------`,
      `*SUMMARY:*`,
      `• *Total NT Hours:* ${totals.nt} / 40.0 hrs ${totals.isNtMet ? '✅ (Target Met)' : '⚠️ (Short)'}`,
      `• *Total Overtime:* ${totals.totalOt} hrs (OT 1.0: ${totals.ot10}h • DT 2.0: ${totals.dt20}h)`,
      `• *Standby Allowance:* ${totals.standbyDays} days`,
      `• *Generated:* ${format(new Date(), 'yyyy-MM-dd HH:mm')}`
    ];

    const message = lines.join('\n');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const selectedWeekDisplay = useMemo(() => {
    const monday = new Date(`${selectedMondayStr}T00:00:00`);
    return format(monday, 'EEE dd MMM yyyy');
  }, [selectedMondayStr]);

  // First available digital signature from entries
  const capturedSignature = useMemo(() => {
    const found = tableRows.find(r => r.signature);
    return found?.signature || null;
  }, [tableRows]);

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6 print:p-0 print:bg-white text-slate-900">
      {/* ACTION BAR (Hidden on Print) */}
      <div className="max-w-5xl mx-auto mb-4 print:hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/time-attendance')}
            className="text-xs text-slate-600 gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Timesheets
          </Button>
          <div className="h-4 w-[1px] bg-slate-300" />
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Weekly Technician Timesheet
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportWhatsApp}
            className="text-xs font-semibold gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <Share2 className="h-3.5 w-3.5" />
            WhatsApp
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveToFirestore}
            disabled={isSaving}
            className="text-xs font-semibold gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </Button>

          <Button
            size="sm"
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Timesheet (A4 / PDF)
          </Button>
        </div>
      </div>

      {/* FILTER & SELECTOR BAR (Hidden on Print) */}
      <div className="max-w-5xl mx-auto mb-5 print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Technician Dropdown */}
          <div className="space-y-1">
            <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-primary" />
              1. Select Technician:
            </label>
            <Select 
              value={selectedUserId} 
              onValueChange={setSelectedUserId}
              disabled={!isManagement && user?.uid !== selectedUserId}
            >
              <SelectTrigger className="w-full bg-slate-50 font-bold border-slate-300 h-9 text-xs">
                <SelectValue placeholder="Choose Technician..." />
              </SelectTrigger>
              <SelectContent>
                {technicians.map(tech => (
                  <SelectItem key={tech.id} value={tech.id} className="text-xs font-semibold">
                    {tech.name} {tech.role ? `(${tech.role})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Week Starting Dropdown */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                2. Select Week Starting (Monday):
              </label>
              <div className="flex items-center gap-1">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handlePrevWeek} 
                  className="h-6 w-6 p-0 text-slate-600 hover:text-slate-900"
                  title="Previous Week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCurrentWeek}
                  className="h-6 text-[10px] font-bold px-1.5 py-0"
                >
                  This Week
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleNextWeek} 
                  className="h-6 w-6 p-0 text-slate-600 hover:text-slate-900"
                  title="Next Week"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Select value={selectedMondayStr} onValueChange={setSelectedMondayStr}>
              <SelectTrigger className="w-full bg-slate-50 font-bold border-slate-300 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs font-semibold">
                    {opt.label} {opt.isCurrent ? '★ Current Week' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* PRINTABLE TIMESHEET CONTAINER */}
      <div className="max-w-5xl mx-auto bg-white border border-slate-300 print:border-none shadow-sm print:shadow-none p-5 sm:p-8 print:p-2 rounded-lg">
        {/* TOP BANNER */}
        <div className="w-full bg-[#dbe2ea] print:bg-[#dbe2ea] border border-slate-400 py-2 text-center mb-4">
          <h1 className="text-lg sm:text-xl font-black tracking-wider text-slate-900 uppercase">
            ALTEK GREEN WEEKLY TECHNICIAN TIMESHEET
          </h1>
        </div>

        {/* HEADER DETAILS ROW */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div className="space-y-2">
            {/* Name */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold w-32 shrink-0">Name:</span>
              <div className="bg-[#fef08a] border border-slate-400 px-3 py-1 font-bold text-sm min-w-[240px]">
                {selectedTechName}
              </div>
            </div>

            {/* Week Starting */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold w-32 shrink-0">Week Starting:</span>
              <div className="bg-[#fef08a] border border-slate-400 px-3 py-1 font-bold text-sm min-w-[240px]">
                {selectedWeekDisplay}
              </div>
            </div>
          </div>

          {/* Right Instruction Note */}
          <div className="max-w-sm text-[11px] text-slate-700 italic leading-snug bg-slate-50 p-2.5 rounded border border-slate-200 print:border-none print:bg-transparent">
            <p>
              Fill in the yellow cells only. Pick the week from the drop-down.
            </p>
            <p className="mt-0.5">
              Type times like 07:00. NT: Mon–Thu 8.5 hrs, Fri 6 hrs (40 per week). Sick note = day paid. Absent, no note = not paid.
            </p>
          </div>
        </div>

        {/* WEEKLY TABLE */}
        <div className="overflow-x-auto border border-slate-400 mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#cbd5e1] border-b border-slate-400 text-slate-900 font-black text-center">
                <th className="border-r border-slate-400 p-2 w-16">Date</th>
                <th className="border-r border-slate-400 p-2 w-12">Day</th>
                <th className="border-r border-slate-400 p-2 w-32">Status</th>
                <th className="border-r border-slate-400 p-2 w-20">Standby</th>
                <th className="border-r border-slate-400 p-2 w-16">Start Time</th>
                <th className="border-r border-slate-400 p-2 w-16">End Time</th>
                <th className="border-r border-slate-400 p-2 w-16 bg-[#e2e8f0]">NT Hrs</th>
                <th className="border-r border-slate-400 p-2 w-20 bg-[#e2e8f0]">Overtime Hours</th>
                <th className="border-r border-slate-400 p-2 w-16">OT 1.0 Hrs</th>
                <th className="border-r border-slate-400 p-2 w-16">DT 2.0 Hrs</th>
                <th className="p-2 text-left">Job Description</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => {
                const isSundayRow = row.dayIndex === 0;
                const isSaturdayRow = row.dayIndex === 6;
                const isWeekend = isSundayRow || isSaturdayRow;

                return (
                  <tr 
                    key={row.date} 
                    className={`border-b border-slate-300 text-center ${
                      isWeekend ? 'bg-slate-50/50' : 'bg-white'
                    }`}
                  >
                    {/* Date */}
                    <td className="border-r border-slate-300 p-1.5 font-semibold text-slate-800">
                      {row.displayDate}
                    </td>

                    {/* Day */}
                    <td className="border-r border-slate-300 p-1.5 font-bold text-slate-800">
                      {row.dayName}
                    </td>

                    {/* Status (Yellow Editable Cell) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] print:bg-[#fef9c3]">
                      <Input
                        value={row.status}
                        onChange={(e) => handleUpdateRow(idx, 'status', e.target.value)}
                        placeholder={isWeekend ? 'Weekend / Off' : 'Present'}
                        className="h-7 text-xs font-semibold text-center bg-transparent border-none shadow-none focus-visible:ring-0 p-1"
                      />
                    </td>

                    {/* Standby (Light Green if Yes) */}
                    <td className={`border-r border-slate-300 p-1 font-bold ${
                      row.isStandby ? 'bg-[#dcfce7] text-[#166534]' : 'bg-white text-slate-500'
                    }`}>
                      <button
                        type="button"
                        onClick={() => handleUpdateRow(idx, 'isStandby', !row.isStandby)}
                        className="w-full h-full py-1 text-center font-bold"
                        title="Click to toggle Standby Yes/No"
                      >
                        {row.isStandby ? 'Yes' : 'No'}
                      </button>
                    </td>

                    {/* Start Time (Yellow Editable Cell) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] print:bg-[#fef9c3]">
                      <Input
                        value={row.startTime}
                        onChange={(e) => handleUpdateRow(idx, 'startTime', e.target.value)}
                        placeholder="07:00"
                        className="h-7 text-xs font-mono font-bold text-center bg-transparent border-none shadow-none focus-visible:ring-0 p-1"
                      />
                    </td>

                    {/* End Time (Yellow Editable Cell) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] print:bg-[#fef9c3]">
                      <Input
                        value={row.endTime}
                        onChange={(e) => handleUpdateRow(idx, 'endTime', e.target.value)}
                        placeholder={row.dayIndex === 5 ? '13:30' : '16:00'}
                        className="h-7 text-xs font-mono font-bold text-center bg-transparent border-none shadow-none focus-visible:ring-0 p-1"
                      />
                    </td>

                    {/* NT Hrs (Gray Calculated Cell) */}
                    <td className="border-r border-slate-300 p-1.5 font-bold bg-[#f1f5f9] text-slate-800">
                      {row.ntHours > 0 ? row.ntHours.toFixed(1).replace('.', ',') : ''}
                    </td>

                    {/* Overtime Hours (Gray Calculated Cell) */}
                    <td className="border-r border-slate-300 p-1.5 font-bold bg-[#f1f5f9] text-slate-900">
                      {row.overtimeHours > 0 ? row.overtimeHours.toFixed(1).replace('.', ',') : ''}
                    </td>

                    {/* OT 1.0 Hrs (Yellow Editable Cell) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] print:bg-[#fef9c3]">
                      <Input
                        type="number"
                        step="0.5"
                        value={row.ot10Hours > 0 ? row.ot10Hours : ''}
                        onChange={(e) => handleUpdateRow(idx, 'ot10Hours', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs font-bold text-center bg-transparent border-none shadow-none focus-visible:ring-0 p-1"
                      />
                    </td>

                    {/* DT 2.0 Hrs (Yellow Editable Cell) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] print:bg-[#fef9c3]">
                      <Input
                        type="number"
                        step="0.5"
                        value={row.dt20Hours > 0 ? row.dt20Hours : ''}
                        onChange={(e) => handleUpdateRow(idx, 'dt20Hours', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs font-bold text-center bg-transparent border-none shadow-none focus-visible:ring-0 p-1"
                      />
                    </td>

                    {/* Job Description (Comments Replaced) */}
                    <td className="p-1 text-left bg-white">
                      <Input
                        value={row.jobDescription}
                        onChange={(e) => handleUpdateRow(idx, 'jobDescription', e.target.value)}
                        placeholder="Job details / breakdown scope..."
                        className="h-7 text-xs text-left bg-transparent border-none shadow-none focus-visible:ring-0 p-1"
                      />
                    </td>
                  </tr>
                );
              })}

              {/* TOTAL ROW */}
              <tr className="bg-[#cbd5e1] font-black border-t-2 border-slate-400 text-center">
                <td colSpan={3} className="border-r border-slate-400 p-2 text-center uppercase tracking-wider">
                  TOTAL
                </td>
                <td className="border-r border-slate-400 p-2 bg-[#dcfce7] text-[#166534]">
                  {totals.standbyDays} days
                </td>
                <td className="border-r border-slate-400 p-2 bg-[#e2e8f0]"></td>
                <td className="border-r border-slate-400 p-2 bg-[#e2e8f0]"></td>
                <td className="border-r border-slate-400 p-2 bg-[#e2e8f0] text-slate-900 font-extrabold">
                  {totals.nt.toFixed(1).replace('.', ',')}
                </td>
                <td className="border-r border-slate-400 p-2 bg-[#e2e8f0] text-slate-900 font-extrabold">
                  {totals.totalOt.toFixed(1).replace('.', ',')}
                </td>
                <td className="border-r border-slate-400 p-2 bg-[#fef9c3] text-slate-900 font-extrabold">
                  {totals.ot10.toFixed(1).replace('.', ',')}
                </td>
                <td className="border-r border-slate-400 p-2 bg-[#fef9c3] text-slate-900 font-extrabold">
                  {totals.dt20.toFixed(1).replace('.', ',')}
                </td>
                <td className="p-2"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* BOTTOM SECTION: SUMMARY BOX + SIGNATURES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-2">
          {/* LEFT: SUMMARY BOX (NAVY BLUE HEADER) */}
          <div className="border border-slate-400 overflow-hidden shadow-xs">
            <div className="bg-[#1e3a5f] text-white px-3 py-1.5 font-black text-xs uppercase tracking-wider">
              SUMMARY
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-300">
                <tr>
                  <td className="p-2 font-medium text-slate-700 bg-slate-50 w-2/3 border-r border-slate-300">
                    NT hours required
                  </td>
                  <td className="p-2 font-bold text-center text-slate-900">
                    {totals.ntRequired.toFixed(1).replace('.', ',')}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-bold text-slate-800 bg-slate-50 border-r border-slate-300">
                    NT hours
                  </td>
                  <td className="p-2 font-extrabold text-center text-slate-900">
                    {totals.nt.toFixed(1).replace('.', ',')}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-slate-700 bg-slate-50 border-r border-slate-300">
                    NT hours short
                  </td>
                  <td className="p-2 font-bold text-center text-red-600">
                    {totals.ntShort.toFixed(1).replace('.', ',')}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-slate-700 bg-slate-50 border-r border-slate-300">
                    Sick days (with note)
                  </td>
                  <td className="p-2 font-bold text-center text-slate-900">
                    {totals.sickDays}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-slate-700 bg-slate-50 border-r border-slate-300">
                    Days absent – NOT paid
                  </td>
                  <td className="p-2 font-bold text-center text-slate-900">
                    {totals.absentDays}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-slate-700 bg-slate-50 border-r border-slate-300">
                    Overtime hours (1.0)
                  </td>
                  <td className="p-2 font-bold text-center text-slate-900">
                    {totals.ot10.toFixed(1).replace('.', ',')}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-slate-700 bg-slate-50 border-r border-slate-300">
                    Double time hours (2.0)
                  </td>
                  <td className="p-2 font-bold text-center text-slate-900">
                    {totals.dt20.toFixed(1).replace('.', ',')}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-bold text-slate-900 bg-slate-100 border-r border-slate-300">
                    Total Overtime hours
                  </td>
                  <td className="p-2 font-extrabold text-center text-slate-900 bg-slate-100">
                    {totals.totalOt.toFixed(1).replace('.', ',')}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-slate-700 bg-slate-50 border-r border-slate-300">
                    Standby days (for allowance)
                  </td>
                  <td className="p-2 font-bold text-center text-emerald-800">
                    {totals.standbyDays}
                  </td>
                </tr>
                <tr className={totals.isNtMet ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]'}>
                  <td className="p-2 font-black border-r border-slate-300">
                    40 hrs NT met this week?
                  </td>
                  <td className="p-2 font-black text-center text-sm">
                    {totals.isNtMet ? (
                      <span className="text-emerald-800">YES</span>
                    ) : (
                      <span className="text-red-700">NO</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* RIGHT: SIGNATURES */}
          <div className="flex flex-col justify-between h-full pt-4 space-y-12">
            {/* Technician Signature */}
            <div className="space-y-3">
              <span className="text-sm font-bold text-slate-800">Technician signature:</span>
              <div className="min-h-[50px] flex items-center justify-start pl-4">
                {capturedSignature ? (
                  <img 
                    src={capturedSignature} 
                    alt="Technician Digital Signature" 
                    className="max-h-12 object-contain"
                  />
                ) : (
                  <div className="h-8" />
                )}
              </div>
              <div className="border-b-2 border-slate-900 w-full" />
              <div className="flex justify-between text-xs text-slate-600 font-semibold px-1">
                <span>{selectedTechName}</span>
                <span>Date: {format(new Date(), 'dd/MM/yyyy')}</span>
              </div>
            </div>

            {/* Supervisor Signature */}
            <div className="space-y-3">
              <span className="text-sm font-bold text-slate-800">Supervisor signature:</span>
              <div className="h-8" />
              <div className="border-b-2 border-slate-900 w-full" />
              <div className="flex justify-between text-xs text-slate-600 font-semibold px-1">
                <span>Services / Operations Manager</span>
                <span>Date: ________________</span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER BRANDING (Visible on Print) */}
        <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <AltekLogo className="h-6" />
            <span>ALTEK GREEN (PTY) LTD • Industrial Electrical &amp; Automation</span>
          </div>
          <div>
            DOC: AG-TA-WTS-001 • Printed: {format(new Date(), 'yyyy-MM-dd HH:mm')}
          </div>
        </div>
      </div>
    </div>
  );
}
