'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import type { Timesheet, TimesheetEntry, User, StandbyShift } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { format, addDays, addMonths, endOfDay } from 'date-fns';
import {
  Printer,
  Share2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User as UserIcon,
  Loader2,
  ArrowLeft,
  Clock,
  Sparkles,
} from 'lucide-react';
import { AltekLogo } from '@/components/altek-logo';
import { getPayrollPeriod } from '@/lib/payroll-utils';

// ---------------------------------------------------------------------------
// HOURS CALCULATION — mirrors calculateRowHours() in /time-attendance/page.tsx
// so the weekly summary always shows the identical NT / OT as the monthly timesheet.
// ---------------------------------------------------------------------------
const getDuration = (startStr?: string, endStr?: string) => {
  if (!startStr || !endStr || startStr === '--:--' || endStr === '--:--' || startStr.trim() === '') return 0;
  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  if (isNaN(sH) || isNaN(eH)) return 0;
  const start = sH + ((sM || 0) / 60);
  let end = eH + ((eM || 0) / 60);
  if (end < start) end += 24;
  return end - start;
};

const calculateHours = (
  dayOfWeek: number,
  normalIn?: string,
  normalOut?: string,
  lunchOut?: string,
  lunchIn?: string,
  calloutIn?: string,
  calloutOut?: string
) => {
  const grossShift = getDuration(normalIn, normalOut);
  let lunchBreak = getDuration(lunchOut, lunchIn);
  const calloutDuration = getDuration(calloutIn, calloutOut);

  if (dayOfWeek >= 1 && dayOfWeek <= 5 && grossShift >= 6 && lunchBreak === 0) {
    lunchBreak = 0.5;
  }

  const netNormalShift = Math.max(0, grossShift - lunchBreak);
  let nt = 0;
  let ot = 0;

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Saturday / Sunday shifts are 100% overtime
    ot = netNormalShift + calloutDuration;
  } else if (dayOfWeek === 5) {
    // Friday: 6.0 NT max
    nt = Math.min(netNormalShift, 6.0);
    ot = Math.max(0, netNormalShift - 6.0) + calloutDuration;
  } else {
    // Monday–Thursday: 8.5 NT max
    nt = Math.min(netNormalShift, 8.5);
    ot = Math.max(0, netNormalShift - 8.5) + calloutDuration;
  }

  return { nt: Number(nt.toFixed(1)), ot: Number(ot.toFixed(1)) };
};

// ---------------------------------------------------------------------------
// PAYROLL PERIOD RESOLUTION
// Timesheets in Firestore are keyed `${userId}_${payrollPeriod}` where
// payrollPeriod is the cycle (e.g. "2026-11" = 18 Oct → 17 Nov).
// ---------------------------------------------------------------------------
const getPayrollKeyForDate = (date: Date): string => {
  const sameMonth = format(date, 'yyyy-MM');
  const nextMonth = format(addMonths(new Date(date.getFullYear(), date.getMonth(), 1), 1), 'yyyy-MM');
  for (const key of [sameMonth, nextMonth]) {
    const { periodStart, periodEnd } = getPayrollPeriod(key);
    if (date >= periodStart && date <= endOfDay(periodEnd)) return key;
  }
  return sameMonth;
};

const hasEntryData = (e?: TimesheetEntry | null) =>
  !!e && !!(e.normalIn || e.normalOut || e.calloutIn || e.calloutOut || e.overtimeReason || e.signature);

// ---------------------------------------------------------------------------
// WEEK HELPERS
// ---------------------------------------------------------------------------
function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function generateWeekOptions() {
  const options = [];
  const currentMonday = getMondayOfWeek(new Date());
  for (let i = 4; i >= -16; i--) {
    const monday = addDays(currentMonday, i * 7);
    const sunday = addDays(monday, 6);
    const val = format(monday, 'yyyy-MM-dd');
    options.push({
      value: val,
      label: `${format(monday, 'EEE dd MMM yyyy')} – ${format(sunday, 'dd MMM yyyy')}`,
      isCurrent: val === format(currentMonday, 'yyyy-MM-dd'),
    });
  }
  return options;
}

const fmt = (n: number) => (n > 0 ? n.toFixed(1).replace('.', ',') : '');
const fmtTotal = (n: number) => n.toFixed(1).replace('.', ',');

export interface WeeklyRowData {
  date: string;
  displayDate: string;
  dayName: string;
  dayIndex: number;
  status: string;
  isStandby: boolean;
  standbyRole: '' | 'Primary' | 'Backup';
  startTime: string;       // normal shift in (blank if none)
  endTime: string;         // normal shift out (blank if none)
  calloutIn: string;       // callout shift in
  calloutOut: string;      // callout shift out
  ntHours: number;
  overtimeHours: number;   // total O/T derived from timesheet
  jobDescription: string;  // callout times + Job Ref
  signature?: string | null;
}

export default function WeeklyTimesheetSummaryPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const router = useRouter();
  const weekOptions = useMemo(() => generateWeekOptions(), []);
  const initialMonday = useMemo(() => format(getMondayOfWeek(new Date()), 'yyyy-MM-dd'), []);

  const [selectedMondayStr, setSelectedMondayStr] = useState<string>(initialMonday);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: currentUserData } = useDoc<User>(userRef);

  const isManagement = useMemo(() => {
    if (!currentUserData?.role) return false;
    const managementRoles = ['Admin', 'Superadmin', 'Client Manager', 'Corporate Manager', 'Services Manager', 'Data Admin', 'Site Supervisor'];
    return managementRoles.some(role => currentUserData.role.includes(role));
  }, [currentUserData]);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<User>(usersQuery);

  const standbyQuery = useMemoFirebase(
    () => query(collection(firestore, 'standby_shifts'), orderBy('startDate', 'asc')),
    [firestore]
  );
  const { data: standbyShifts } = useCollection<StandbyShift>(standbyQuery);

  // Same technician filter as monthly timesheet "Admin: View Employee" dropdown
  const technicians = useMemo(() => {
    if (!allUsers) return [];
    return allUsers
      .filter(u =>
        u.role?.includes('Technician') ||
        u.role?.includes('Engineer') ||
        u.role?.includes('Technologist') ||
        u.timesheetEnabled === true
      )
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allUsers]);

  useEffect(() => {
    if (selectedUserId || !user) return;
    if (isManagement) {
      const defaultTech = technicians.find(t => t.id === user.uid) || technicians[0];
      if (defaultTech) setSelectedUserId(defaultTech.id);
    } else {
      setSelectedUserId(user.uid);
    }
  }, [selectedUserId, user, isManagement, technicians]);

  const selectedTechnician = useMemo(
    () => technicians.find(t => t.id === selectedUserId) || allUsers?.find(u => u.id === selectedUserId) || null,
    [technicians, allUsers, selectedUserId]
  );
  const selectedTechName = selectedTechnician?.name || 'Technician';

  const currentWeekDates = useMemo(() => {
    const monday = new Date(`${selectedMondayStr}T00:00:00`);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [selectedMondayStr]);

  // Payroll period key for each day of the week (e.g. 19 Oct → "2026-11")
  const payrollKeyByDate = useMemo(() => {
    const map = new Map<string, string>();
    currentWeekDates.forEach(d => map.set(format(d, 'yyyy-MM-dd'), getPayrollKeyForDate(d)));
    return map;
  }, [currentWeekDates]);

  // Query all periods that cover this week (payroll period + calendar month for fallback)
  const relevantPeriods = useMemo(() => {
    const periods = new Set<string>();
    currentWeekDates.forEach(d => {
      periods.add(getPayrollKeyForDate(d));
      periods.add(format(d, 'yyyy-MM'));
    });
    return Array.from(periods);
  }, [currentWeekDates]);

  const timesheetsQuery = useMemoFirebase(() => {
    if (!selectedUserId || relevantPeriods.length === 0) return null;
    return query(
      collection(firestore, 'timesheets'),
      where('userId', '==', selectedUserId),
      where('period', 'in', relevantPeriods)
    );
  }, [firestore, selectedUserId, relevantPeriods]);

  const { data: userTimesheets, isLoading: timesheetsLoading } = useCollection<Timesheet>(timesheetsQuery);

  // ---------------------------------------------------------------------------
  // LIVE CARBON COPY DERIVATION
  // 100% derived from the actual monthly timesheet data. Any edit made on the
  // monthly timesheet triggers an automatic real-time update here.
  // ---------------------------------------------------------------------------
  const tableRows = useMemo<WeeklyRowData[]>(() => {
    if (currentWeekDates.length !== 7) return [];

    // Map each date to its timesheet entry, preferring the doc for the correct payroll period
    const entryByDate = new Map<string, TimesheetEntry>();
    (userTimesheets || []).forEach(ts => {
      (ts.entries || []).forEach(e => {
        if (!e?.date || !payrollKeyByDate.has(e.date)) return;
        const existing = entryByDate.get(e.date);
        const isCorrectPeriod = ts.period === payrollKeyByDate.get(e.date);
        if (!existing) {
          entryByDate.set(e.date, e);
        } else if (isCorrectPeriod && hasEntryData(e)) {
          entryByDate.set(e.date, e);
        } else if (!hasEntryData(existing) && hasEntryData(e)) {
          entryByDate.set(e.date, e);
        }
      });
    });

    // Standby lookup: date >= startDate && date < endDate
    const cleanName = (s?: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const techName = cleanName(selectedTechName);
    const techShifts = (standbyShifts || []).filter(
      s => cleanName(s.primaryTech) === techName || cleanName(s.backupTech) === techName
    );

    return currentWeekDates.map((dayDate): WeeklyRowData => {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dayOfWeek = dayDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const entry = entryByDate.get(dateStr);

      const dayShifts = techShifts.filter(s => dateStr >= s.startDate && dateStr < s.endDate);
      const isPrimary = dayShifts.some(s => cleanName(s.primaryTech) === techName);
      const isBackup = dayShifts.some(s => cleanName(s.backupTech) === techName);

      // Derive exact NT and OT
      const { nt: calcNt, ot: calcOt } = calculateHours(
        dayOfWeek,
        entry?.normalIn, entry?.normalOut,
        entry?.lunchOut, entry?.lunchIn,
        entry?.calloutIn, entry?.calloutOut
      );

      // Use stored values if available, else calculated
      const nt = entry?.calculatedNT != null ? entry.calculatedNT : calcNt;
      const ot = (entry?.calculatedOT15 || 0) + (entry?.calculatedOT20 || 0) > 0
        ? (entry?.calculatedOT15 || 0) + (entry?.calculatedOT20 || 0)
        : calcOt;

      // Callout times & Job description
      const jobRef = (entry?.overtimeReason || entry?.comments || '').trim();
      const lowerRef = jobRef.toLowerCase();
      const validCalloutIn = entry?.calloutIn && entry.calloutIn !== '--:--' ? entry.calloutIn : '';
      const validCalloutOut = entry?.calloutOut && entry.calloutOut !== '--:--' ? entry.calloutOut : '';
      const hasCallout = !!(validCalloutIn && validCalloutOut);

      // Normal shift times (leave blank if not worked)
      const validNormalIn = entry?.normalIn && entry.normalIn !== '--:--' ? entry.normalIn : '';
      const validNormalOut = entry?.normalOut && entry.normalOut !== '--:--' ? entry.normalOut : '';

      // Determine Status
      let status = '';
      if (/\bsick\b/.test(lowerRef)) status = 'Sick (with note)';
      else if (/\b(leave|holiday)\b/.test(lowerRef)) status = 'Leave';
      else if (/\babsent\b/.test(lowerRef)) status = 'Absent';
      else if (nt > 0) status = 'Present';
      else if (ot > 0 && hasCallout) status = 'Call-Out';
      else if (isWeekend) status = (isPrimary || isBackup) ? 'Standby' : 'Off';
      else if (dateStr < format(new Date(), 'yyyy-MM-dd')) status = hasEntryData(entry) ? 'Present' : 'Off';

      return {
        date: dateStr,
        displayDate: format(dayDate, 'dd MMM'),
        dayName: format(dayDate, 'EEE'),
        dayIndex: dayOfWeek,
        status,
        isStandby: isPrimary || isBackup,
        standbyRole: isPrimary ? 'Primary' : isBackup ? 'Backup' : '',
        startTime: validNormalIn,
        endTime: validNormalOut,
        calloutIn: validCalloutIn,
        calloutOut: validCalloutOut,
        ntHours: nt,
        overtimeHours: ot,
        jobDescription: jobRef,
        signature: entry?.signature || null,
      };
    });
  }, [currentWeekDates, userTimesheets, standbyShifts, selectedTechName, payrollKeyByDate]);

  // Derived Totals & Summary Metrics (strictly no OT 2.0)
  const totals = useMemo(() => {
    let nt = 0;
    let ot = 0;
    let standbyDays = 0;
    let sickDays = 0;
    let absentDays = 0;

    tableRows.forEach(r => {
      nt += Number(r.ntHours || 0);
      ot += Number(r.overtimeHours || 0);
      if (r.isStandby) standbyDays += 1;
      if (r.status.toLowerCase().includes('sick')) sickDays += 1;
      if (r.status.toLowerCase().includes('absent')) absentDays += 1;
    });

    const ntRequired = 40.0;
    const ntRounded = Number(nt.toFixed(1));
    const otRounded = Number(ot.toFixed(1));
    const ntShort = Math.max(0, Number((ntRequired - ntRounded).toFixed(1)));

    return {
      nt: ntRounded,
      ot: otRounded,
      standbyDays,
      sickDays,
      absentDays,
      ntRequired,
      ntShort,
      isNtMet: ntRounded >= ntRequired,
    };
  }, [tableRows]);

  // Week stepper
  const curWeekIndex = weekOptions.findIndex(w => w.value === selectedMondayStr);
  const handlePrevWeek = () => {
    if (curWeekIndex !== -1 && curWeekIndex < weekOptions.length - 1) {
      setSelectedMondayStr(weekOptions[curWeekIndex + 1].value);
    }
  };
  const handleNextWeek = () => {
    if (curWeekIndex > 0) {
      setSelectedMondayStr(weekOptions[curWeekIndex - 1].value);
    }
  };

  const selectedWeekDisplay = useMemo(
    () => format(new Date(`${selectedMondayStr}T00:00:00`), 'EEE dd MMM yyyy'),
    [selectedMondayStr]
  );

  const handleExportWhatsApp = () => {
    const lines: string[] = [
      `*ALTEK GREEN WEEKLY TIMESHEET*`,
      `*Technician:* ${selectedTechName}`,
      `*Week Starting:* ${selectedWeekDisplay}`,
      `-----------------------------------------`,
      ...tableRows.map(r => {
        const times = r.startTime && r.endTime ? ` (${r.startTime} - ${r.endTime})` : '';
        const co = r.calloutIn && r.calloutOut ? ` [C/O ${r.calloutIn} - ${r.calloutOut}]` : '';
        const sb = r.isStandby ? ` [Standby]` : '';
        const desc = r.jobDescription ? `\n  _${r.jobDescription}_` : '';
        return `• *${r.dayName} ${r.displayDate}*: ${r.status || '-'}${times}${co}${sb} | NT: ${r.ntHours}h | OT: ${r.overtimeHours}h${desc}`;
      }),
      `-----------------------------------------`,
      `*SUMMARY:*`,
      `• *NT Hours:* ${totals.nt} / 40.0 ${totals.isNtMet ? '✅ (Met)' : '⚠️ (Short ' + totals.ntShort + 'h)'}`,
      `• *Overtime Hours:* ${totals.ot}h`,
      `• *Standby Days:* ${totals.standbyDays}`,
      `• *Sick Days:* ${totals.sickDays}`,
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  const capturedSignature = useMemo(
    () => tableRows.find(r => r.signature)?.signature || null,
    [tableRows]
  );

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6 print:p-0 print:bg-white text-slate-900">
      {/* ACTION BAR */}
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
            <Share2 className="h-3.5 w-3.5" /> WhatsApp
          </Button>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> Print Timesheet (A4 / PDF)
          </Button>
        </div>
      </div>

      {/* SELECTORS & LIVE BADGE */}
      <div className="max-w-5xl mx-auto mb-5 print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-primary" /> 1. Select Technician:
            </label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={!isManagement}>
              <SelectTrigger className="w-full bg-slate-50 font-bold border-slate-300 h-9 text-xs">
                <SelectValue placeholder="Choose Technician..." />
              </SelectTrigger>
              <SelectContent>
                {technicians.map(tech => (
                  <SelectItem key={tech.id} value={tech.id} className="text-xs font-semibold">
                    {tech.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> 2. Select Week Starting (Monday):
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevWeek}
                  className="h-6 w-6 p-0"
                  title="Previous Week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMondayStr(initialMonday)}
                  className="h-6 text-[10px] font-bold px-1.5 py-0"
                >
                  This Week
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleNextWeek}
                  className="h-6 w-6 p-0"
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

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Live carbon copy: Automatically synced with {selectedTechName}&apos;s monthly timesheet.</span>
          </div>
          {timesheetsLoading && (
            <span className="flex items-center gap-1 text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Syncing...
            </span>
          )}
        </div>
      </div>

      {/* PRINTABLE SHEET */}
      <div className="max-w-5xl mx-auto bg-white border border-slate-300 print:border-none shadow-sm print:shadow-none p-5 sm:p-8 print:p-2 rounded-lg">
        {/* HEADER TITLE BANNER */}
        <div className="w-full bg-[#dbe2ea] border border-slate-400 py-2 text-center mb-4">
          <h1 className="text-lg sm:text-xl font-black tracking-wider text-slate-900 uppercase">
            ALTEK GREEN WEEKLY TECHNICIAN TIMESHEET
          </h1>
        </div>

        {/* METADATA + INSTRUCTIONS */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold w-32 shrink-0">Name:</span>
              <div className="bg-[#fef08a] border border-slate-400 px-3 py-1 font-bold text-sm min-w-[240px]">
                {selectedTechName}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold w-32 shrink-0">Week Starting:</span>
              <div className="bg-[#fef08a] border border-slate-400 px-3 py-1 font-bold text-sm min-w-[240px]">
                {selectedWeekDisplay}
              </div>
            </div>
          </div>
          <div className="max-w-sm text-[11px] text-slate-700 italic leading-snug bg-slate-50 p-2.5 rounded border border-slate-200 print:border-none print:bg-transparent">
            <p>Read-only summary derived from the monthly timesheet. Pick the technician and week above.</p>
            <p className="mt-0.5">NT: Mon–Thu 8.5 hrs, Fri 6 hrs (40 per week). Weekend &amp; call-outs = overtime. Sick note = day paid. Absent, no note = not paid.</p>
          </div>
        </div>

        {/* 7-DAY SUMMARY TABLE */}
        <div className="overflow-x-auto border border-slate-400 mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#cbd5e1] border-b border-slate-400 text-slate-900 font-black text-center text-xs">
                <th rowSpan={2} className="border-r border-slate-400 p-1.5 w-14 whitespace-nowrap">Date</th>
                <th rowSpan={2} className="border-r border-slate-400 p-1.5 w-10 whitespace-nowrap">Day</th>
                <th rowSpan={2} className="border-r border-slate-400 p-1.5 w-16 whitespace-nowrap">Status</th>
                <th rowSpan={2} className="border-r border-slate-400 p-1.5 w-14 whitespace-nowrap">Standby</th>
                <th colSpan={2} className="border-r border-slate-400 p-1 bg-[#dbe2ea] text-slate-900 font-black tracking-wide">
                  Normal Shift
                </th>
                <th colSpan={2} className="border-r border-slate-400 p-1 bg-[#fed7aa] text-amber-950 font-black tracking-wide">
                  Callout Shift
                </th>
                <th rowSpan={2} className="border-r border-slate-400 p-1.5 w-14 bg-[#e2e8f0] whitespace-nowrap">NT Hrs</th>
                <th rowSpan={2} className="border-r border-slate-400 p-1.5 w-16 bg-[#e2e8f0] whitespace-nowrap">Overtime Hours</th>
                <th rowSpan={2} className="p-2 text-left">Job Description</th>
              </tr>
              <tr className="bg-[#cbd5e1] border-b border-slate-400 text-slate-900 font-black text-center text-[10px]">
                <th className="border-r border-slate-400 p-1 w-14 whitespace-nowrap">Start Time</th>
                <th className="border-r border-slate-400 p-1 w-14 whitespace-nowrap">End Time</th>
                <th className="border-r border-slate-400 p-1 w-14 whitespace-nowrap bg-[#fed7aa]/60 text-amber-950">Start Time</th>
                <th className="border-r border-slate-400 p-1 w-14 whitespace-nowrap bg-[#fed7aa]/60 text-amber-950">End Time</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const isWeekend = row.dayIndex === 0 || row.dayIndex === 6;
                return (
                  <tr
                    key={row.date}
                    className={`border-b border-slate-300 text-center ${isWeekend ? 'bg-slate-50' : 'bg-white'}`}
                  >
                    {/* Date */}
                    <td className="border-r border-slate-300 p-1.5 font-semibold whitespace-nowrap">
                      {row.displayDate}
                    </td>

                    {/* Day */}
                    <td className={`border-r border-slate-300 p-1.5 font-bold whitespace-nowrap ${isWeekend ? 'text-red-700' : ''}`}>
                      {row.dayName}
                    </td>

                    {/* Status (Yellow cell) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] font-semibold text-slate-900 text-[11px] whitespace-nowrap">
                      {row.status || '-'}
                    </td>

                    {/* Standby (Green cell if yes) */}
                    <td
                      className={`border-r border-slate-300 p-1 font-bold ${
                        row.isStandby ? 'bg-[#dcfce7] text-[#166534]' : 'text-slate-400'
                      }`}
                    >
                      <div className="text-[11px] leading-tight">{row.isStandby ? 'Yes' : 'No'}</div>
                      {row.isStandby && row.standbyRole && (
                        <span className="block text-[8px] font-semibold opacity-80 leading-tight">
                          {row.standbyRole}
                        </span>
                      )}
                    </td>

                    {/* Normal Shift Start Time (Yellow cell) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] font-mono font-bold text-slate-900 text-center">
                      {row.startTime || ''}
                    </td>

                    {/* Normal Shift End Time (Yellow cell) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] font-mono font-bold text-slate-900 text-center">
                      {row.endTime || ''}
                    </td>

                    {/* Callout Shift Start Time (Yellow cell with red text for callouts) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] font-mono font-bold text-red-700 text-center">
                      {row.calloutIn || ''}
                    </td>

                    {/* Callout Shift End Time (Yellow cell with red text for callouts) */}
                    <td className="border-r border-slate-300 p-1 bg-[#fef9c3] font-mono font-bold text-red-700 text-center">
                      {row.calloutOut || ''}
                    </td>

                    {/* NT Hrs (Gray cell) */}
                    <td className="border-r border-slate-300 p-1.5 font-bold bg-[#f1f5f9] text-emerald-800 text-center">
                      {fmt(row.ntHours)}
                    </td>

                    {/* Overtime Hours (Gray cell) */}
                    <td className="border-r border-slate-300 p-1.5 font-bold bg-[#f1f5f9] text-red-700 text-center">
                      {fmt(row.overtimeHours)}
                    </td>

                    {/* Job Description (Left-aligned text) */}
                    <td className="p-1.5 text-left font-medium text-slate-800 break-words">
                      {row.jobDescription || '-'}
                    </td>
                  </tr>
                );
              })}

              {/* TOTAL ROW */}
              <tr className="bg-[#cbd5e1] font-black border-t-2 border-slate-400 text-center">
                <td colSpan={3} className="border-r border-slate-400 p-1.5 uppercase tracking-wider">
                  TOTAL
                </td>
                <td className="border-r border-slate-400 p-1.5 bg-[#dcfce7] text-[#166534]">
                  {totals.standbyDays} days
                </td>
                <td className="border-r border-slate-400 p-1 bg-[#e2e8f0]"></td>
                <td className="border-r border-slate-400 p-1 bg-[#e2e8f0]"></td>
                <td className="border-r border-slate-400 p-1 bg-[#e2e8f0]"></td>
                <td className="border-r border-slate-400 p-1 bg-[#e2e8f0]"></td>
                <td className="border-r border-slate-400 p-1.5 bg-[#e2e8f0]">
                  {fmtTotal(totals.nt)}
                </td>
                <td className="border-r border-slate-400 p-1.5 bg-[#e2e8f0]">
                  {fmtTotal(totals.ot)}
                </td>
                <td className="p-1.5"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* BOTTOM SECTION: SUMMARY BOX & SIGNATURES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-2">
          {/* NAVY-BLUE SUMMARY BOX */}
          <div className="border border-slate-400 overflow-hidden">
            <div className="bg-[#1e3a5f] text-white px-3 py-1.5 font-black text-xs uppercase tracking-wider">
              SUMMARY
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-300">
                <tr>
                  <td className="p-2 bg-slate-50 w-2/3 border-r border-slate-300">NT hours required</td>
                  <td className="p-2 font-bold text-center">{fmtTotal(totals.ntRequired)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">NT hours</td>
                  <td className="p-2 font-extrabold text-center">{fmtTotal(totals.nt)}</td>
                </tr>
                <tr>
                  <td className="p-2 bg-slate-50 border-r border-slate-300">NT hours short</td>
                  <td className={`p-2 font-bold text-center ${totals.ntShort > 0 ? 'text-red-600' : ''}`}>
                    {fmtTotal(totals.ntShort)}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 bg-slate-50 border-r border-slate-300">Sick days (with note)</td>
                  <td className="p-2 font-bold text-center">{totals.sickDays}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Days absent – NOT paid</td>
                  <td className="p-2 font-bold text-center">{totals.absentDays}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-100 border-r border-slate-300">Overtime hours</td>
                  <td className="p-2 font-extrabold text-center bg-slate-100 text-red-700">
                    {fmtTotal(totals.ot)}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Standby days (for allowance)</td>
                  <td className="p-2 font-bold text-center text-emerald-800">{totals.standbyDays}</td>
                </tr>
                <tr className={totals.isNtMet ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]'}>
                  <td className="p-2 font-black border-r border-slate-300">40 hrs NT met this week?</td>
                  <td className={`p-2 font-black text-center text-sm ${totals.isNtMet ? 'text-emerald-800' : 'text-red-700'}`}>
                    {totals.isNtMet ? 'YES' : 'NO'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SIGNATURES */}
          <div className="flex flex-col justify-between h-full pt-4 space-y-12">
            <div className="space-y-3">
              <span className="text-sm font-bold">Technician signature:</span>
              <div className="min-h-[50px] flex items-center pl-4">
                {capturedSignature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={capturedSignature}
                    alt="Technician signature"
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

            <div className="space-y-3">
              <span className="text-sm font-bold">Supervisor signature:</span>
              <div className="h-8" />
              <div className="border-b-2 border-slate-900 w-full" />
              <div className="flex justify-between text-xs text-slate-600 font-semibold px-1">
                <span>Services / Operations Manager</span>
                <span>Date: ________________</span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <AltekLogo className="h-6" />
            <span>ALTEK GREEN (PTY) LTD • Industrial Electrical &amp; Automation</span>
          </div>
          <div>DOC: AG-TA-WTS-001 • Printed: {format(new Date(), 'yyyy-MM-dd HH:mm')}</div>
        </div>
      </div>
    </div>
  );
}
