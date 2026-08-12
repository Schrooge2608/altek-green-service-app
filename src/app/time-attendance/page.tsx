
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/signature-pad';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
  useDoc,
  useFirebase,
} from '@/firebase';
import { collection, doc, query, orderBy, setDoc, updateDoc } from 'firebase/firestore';
import type { Timesheet, TimesheetEntry, User, StandbyShift } from '@/lib/types';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  format,
  parseISO,
  getDay,
  addMonths,
  addDays,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { 
  Loader2, 
  Save, 
  Clock, 
  BadgeCheck, 
  X, 
  Printer, 
  CheckCircle2,
  Timer,
  MapPin,
  AlertTriangle,
  History,
  ShieldCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useKiosk } from '@/components/kiosk/kiosk-provider';
import { useRouter } from 'next/navigation';
import { getPayrollPeriod, getDefaultPayrollMonth } from '@/lib/payroll-utils';

// --- GEOFENCE CONSTANTS ---
const SMELTER_LAT = -28.685108;
const SMELTER_LON = 32.139111;
const MINING_LAT = -28.608080;
const MINING_LON = 32.294436;
const AUTHORIZED_RADIUS_KM = 2.0; 

// --- HELPERS ---
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// CROSS-MIDNIGHT MATH
const getDuration = (startStr?: string, endStr?: string) => {
  if (!startStr || !endStr || startStr === '--:--' || endStr === '--:--' || startStr === '') return 0;
  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  let start = sH + (sM / 60);
  let end = eH + (eM / 60);
  if (end < start) end += 24; 
  return end - start;
};

const calculateRowHours = (row: TimesheetEntry) => {
  if (!row.date) return row;
  const rowDate = new Date(row.date);
  const dayOfWeek = rowDate.getDay(); 
  let grossShift = getDuration(row.normalIn, row.normalOut);
  let lunchBreak = getDuration(row.lunchOut, row.lunchIn);
  let calloutDuration = getDuration(row.calloutIn, row.calloutOut);
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && grossShift >= 6 && lunchBreak === 0) {
    lunchBreak = 0.5;
  }
  
  let netNormalShift = Math.max(0, grossShift - lunchBreak);
  let nt = 0, ot15 = 0, ot20 = 0;
  
  if (dayOfWeek === 0) { 
    ot20 = netNormalShift + calloutDuration; 
  } else if (dayOfWeek === 6) { 
    ot15 = netNormalShift + calloutDuration; 
  } else if (dayOfWeek === 5) { 
    nt = Math.min(netNormalShift, 6.0); 
    ot15 = Math.max(0, netNormalShift - 6.0) + calloutDuration; 
  } else { 
    nt = Math.min(netNormalShift, 8.5); 
    ot15 = Math.max(0, netNormalShift - 8.5) + calloutDuration; 
  }
  
  return { 
    ...row, 
    calculatedNT: Number(nt.toFixed(1)), 
    calculatedOT15: Number(ot15.toFixed(1)), 
    calculatedOT20: Number(ot20.toFixed(1)) 
  };
};

/**
 * REPLACED: Strictly snaps to nearest whole hour.
 * 0-29 -> Down
 * 30-59 -> Up
 */
const roundTimeAltekStyle = (date: Date = new Date()) => {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  
  if (minutes < 30) {
    minutes = 0;
  } else {
    hours += 1;
    minutes = 0;
  }
  
  if (hours >= 24) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

function generateMonthOptions() {
  const options = [];
  const today = new Date();
  for (let i = -6; i <= 6; i++) {
    const date = addMonths(today, i);
    options.push({ value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') });
  }
  return options;
}

export default function TimesheetPage() {
  const { auth, firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const { activeKioskUser, logoutKioskUser } = useKiosk();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [viewedUserId, setViewedUserId] = useState<string>('');
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [isVerifyingGPS, setIsVerifyingGPS] = useState(false);

  // FETCH USERS
  const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: currentUserData, isLoading: currentUserLoading } = useDoc<User>(userRoleRef);

  const isElevated = useMemo(() => {
    if (!currentUserData?.role) return false;
    return ['Admin', 'Superadmin', 'Data Admin', 'Services Manager'].includes(currentUserData.role);
  }, [currentUserData]);

  const isClient = currentUserData?.role === 'Client Manager';

  // RBAC: Redirect Clients instantly
  useEffect(() => {
    if (currentUserData && isClient) {
      router.push('/');
    }
  }, [currentUserData, isClient, router]);

  useEffect(() => {
    // Set dynamic default period based on Altek rollover logic
    setSelectedPeriod(getDefaultPayrollMonth());
    
    if (!isUserLoading && user && !isElevated) {
      logoutKioskUser();
    }
    
    refreshLocation();
  }, [user, isUserLoading, isElevated, logoutKioskUser]);

  useEffect(() => {
    if (!user || isUserLoading || currentUserLoading || !allUsers) return;
    
    if (!isElevated) {
      setViewedUserId(user.uid);
    } else if (!viewedUserId) {
      const tech = allUsers.find(u => 
        u.role?.includes('Technician') || 
        u.role?.includes('Engineer') || 
        u.role?.includes('Technologist') ||
        u.timesheetEnabled === true
      );
      setViewedUserId(activeKioskUser?.id || tech?.id || user.uid);
    }
  }, [user, isUserLoading, currentUserLoading, isElevated, activeKioskUser, viewedUserId, allUsers]);

  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsVerifyingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const distSmelter = calculateDistance(position.coords.latitude, position.coords.longitude, SMELTER_LAT, SMELTER_LON);
        const distMining = calculateDistance(position.coords.latitude, position.coords.longitude, MINING_LAT, MINING_LON);
        const minDistance = Math.min(distSmelter, distMining);
        setCurrentDistance(minDistance);
        setIsVerifyingGPS(false);
      },
      () => setIsVerifyingGPS(false),
      { enableHighAccuracy: true }
    );
  }, []);

  const standbyShiftsQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'standby_shifts'), orderBy('startDate', 'asc')) : null), [firestore, user]);
  const { data: standbyShifts } = useCollection<StandbyShift>(standbyShiftsQuery);

  const targetUserMatch = useMemo(() => {
    if (!allUsers || !viewedUserId) return null;
    return allUsers.find(u => u.id === viewedUserId);
  }, [allUsers, viewedUserId]);

  const viewedUserName = targetUserMatch?.name || 'Technician';

  const evaluatedStandbyWeeks = useMemo(() => {
    if (!standbyShifts || !viewedUserId || !viewedUserName) return [];
    return standbyShifts
      .filter(data => data.primaryTech === viewedUserName || data.backupTech === viewedUserName)
      .map(data => {
        const start = new Date(data.startDate); start.setHours(16, 0, 0, 0); 
        const end = new Date(data.endDate); end.setHours(7, 0, 0, 0); 
        return { 
          id: data.id, startDate: data.startDate, endDate: data.endDate, exactStart: start, exactEnd: end, 
          isPrimary: data.primaryTech === viewedUserName, isBackup: data.backupTech === viewedUserName
        };
      });
  }, [standbyShifts, viewedUserId, viewedUserName]);

  const timesheetId = useMemo(() => (viewedUserId && selectedPeriod ? `${viewedUserId}_${selectedPeriod}` : null), [viewedUserId, selectedPeriod]);
  const timesheetRef = useMemoFirebase(() => (timesheetId ? doc(firestore, 'timesheets', timesheetId) : null), [firestore, timesheetId]);
  const { data: fetchedTimesheet, isLoading: timesheetLoading } = useDoc<Timesheet>(timesheetRef);

  const dateRange = useMemo(() => {
    if (!selectedPeriod) return [];
    const { periodStart, periodEnd } = getPayrollPeriod(selectedPeriod);
    const days = [];
    let currentDate = new Date(periodStart);
    while (currentDate <= periodEnd) {
      days.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate = addDays(currentDate, 1);
    }
    return days;
  }, [selectedPeriod]);
  
  useEffect(() => {
    if (timesheetLoading || !dateRange.length || !viewedUserId || !selectedPeriod) return;
    const entriesMap = new Map(fetchedTimesheet?.entries?.map((e: any) => [e.date, e]) || []);
    const newEntries: TimesheetEntry[] = dateRange.map((dateStr) => {
      const existingEntry = entriesMap.get(dateStr);
      return existingEntry || { 
        date: dateStr, normalIn: '', normalOut: '', lunchOut: '', lunchIn: '', calloutIn: '', calloutOut: '',
        calculatedNT: 0, calculatedOT15: 0, calculatedOT20: 0, overtimeReason: '', signature: null,
        isFlagged: false, location_warning: false, distanceKm: null
      };
    });
    setTimesheet({ 
      id: timesheetId!, 
      userId: viewedUserId, 
      userName: viewedUserName!, 
      period: selectedPeriod, 
      entries: newEntries,
      adminOverrides: fetchedTimesheet?.adminOverrides || {}
    });
  }, [fetchedTimesheet, timesheetLoading, dateRange, viewedUserId, selectedPeriod, timesheetId, viewedUserName]);

  const handleRealTimeClock = async (type: 'IN' | 'OUT' | 'CIN' | 'COUT', index: number) => {
    if (!navigator.geolocation || !auth.currentUser || !timesheet) return;
    if (!isElevated && isClient) return;

    setIsVerifyingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const now = new Date();
        const snappedTime = roundTimeAltekStyle(now);
        
        let targetIndex = index;
        const isCallout = type === 'CIN' || type === 'COUT';
        
        if (isCallout && now.getHours() < 9) {
          const yesterdayDate = new Date(now);
          yesterdayDate.setDate(now.getDate() - 1);
          const yesterdayStr = format(yesterdayDate, 'yyyy-MM-dd');
          const foundIdx = timesheet.entries.findIndex(e => e.date === yesterdayStr);
          if (foundIdx !== -1) targetIndex = foundIdx;
        }

        const dist = Math.min(calculateDistance(position.coords.latitude, position.coords.longitude, SMELTER_LAT, SMELTER_LON), calculateDistance(position.coords.latitude, position.coords.longitude, MINING_LAT, MINING_LON));
        const entryIsOutOfRange = dist > AUTHORIZED_RADIUS_KM;
        
        const newEntries = [...timesheet.entries];
        const entry = { ...newEntries[targetIndex] };
        
        if (type === 'IN') entry.normalIn = snappedTime;
        else if (type === 'OUT') entry.normalOut = snappedTime;
        else if (type === 'CIN') entry.calloutIn = snappedTime;
        else if (type === 'COUT') entry.calloutOut = snappedTime;

        entry.isOutOfRange = entry.isOutOfRange || entryIsOutOfRange;
        entry.distanceFromSite = dist.toFixed(2);
        
        newEntries[targetIndex] = calculateRowHours(entry);
        const updated = { ...timesheet, entries: newEntries };
        setTimesheet(updated);

        try {
          const targetTsId = `${auth.currentUser.uid}_${selectedPeriod}`;
          const tsRef = doc(firestore, 'timesheets', targetTsId);
          await setDoc(tsRef, updated, { merge: true });
          toast({ title: "Clock Successful", description: `Time saved to ${newEntries[targetIndex].date}` });
        } catch (error: any) {
          alert("CRITICAL ERROR: Failed to save time data. " + (error.message || "Permission Denied."));
        }
        setIsVerifyingGPS(false);
      },
      () => {
        setIsVerifyingGPS(false);
        alert("GPS ERROR: Could not determine location. Please ensure location services are enabled.");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleEntryChange = async (index: number, field: keyof TimesheetEntry, value: any) => {
    if (!timesheet || !auth.currentUser) return;
    
    const isOwner = auth.currentUser.uid === viewedUserId;
    if (!isElevated && !isOwner) return;

    const newEntries = [...timesheet.entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    
    const timeFields = ['normalIn', 'normalOut', 'calloutIn', 'calloutOut', 'isOutOfRange'];
    if (timeFields.includes(field as string)) {
      if (field !== 'isOutOfRange') {
        newEntries[index].isOutOfRange = false;
      }
    }

    const updated = { ...timesheet, entries: newEntries.map(calculateRowHours) };
    setTimesheet(updated);
    
    try {
      const targetTsId = `${viewedUserId}_${selectedPeriod}`;
      const tsRef = doc(firestore, 'timesheets', targetTsId);
      await setDoc(tsRef, updated, { merge: true });
    } catch (e: any) {
      console.error("Timesheet persistence: FAILURE", e);
      alert("Database error: " + e.message);
      throw e;
    }
  };

  const handleAdminOverride = async (shiftId: string, status: 'QUALIFIED' | 'DISQUALIFIED' | null) => {
    if (!timesheet || !isElevated) return;
    
    const newOverrides = { 
      ...(timesheet.adminOverrides || {}), 
      [shiftId]: status 
    };
    
    const updated = { ...timesheet, adminOverrides: newOverrides };
    setTimesheet(updated);

    try {
      const tsRef = doc(firestore, 'timesheets', timesheet.id);
      await updateDoc(tsRef, { adminOverrides: newOverrides });
      toast({ 
        title: "Status Overridden", 
        description: `Qualification for shift ${shiftId} set to ${status || 'Automatic'}.` 
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Update Failed", description: e.message });
    }
  };

  const totals = useMemo(() => {
    if (!timesheet) return null;
    let n = 0, o15 = 0, o20 = 0;
    timesheet.entries.forEach(entry => {
      const calc = calculateRowHours(entry);
      n += Number(calc.calculatedNT || 0); 
      o15 += Number(calc.calculatedOT15 || 0); 
      o20 += Number(calc.calculatedOT20 || 0);
    });
    return { 
      normal: Number(n.toFixed(1)), 
      ot15: Number(o15.toFixed(1)), 
      ot20: Number(o20.toFixed(1)), 
      total: Number((n + o15 + o20).toFixed(1)) 
    };
  }, [timesheet]);

  const standbyWeeksInCycle = useMemo(() => {
    if (evaluatedStandbyWeeks.length === 0 || !dateRange.length) return [];
    const cycleStart = startOfDay(new Date(dateRange[0]));
    const cycleEnd = endOfDay(new Date(dateRange[dateRange.length - 1]));
    return evaluatedStandbyWeeks.filter(week => week.exactEnd >= cycleStart && week.exactStart <= cycleEnd);
  }, [evaluatedStandbyWeeks, dateRange]);

  const isViewingSelf = user?.uid === viewedUserId;

  return (
    <div className="p-4 md:p-6 space-y-6 print:p-0 print:m-0 print:space-y-2 print:w-full print:bg-white text-black">
      <style>{'@media print { @page { size: landscape; } }'}</style>
      <Card className="p-8 shadow-lg print:shadow-none print:border-none border-slate-200">
        <header className="flex flex-col md:flex-row items-center justify-between mb-8 border-b pb-6 print:hidden gap-6">
          <div className="flex items-center gap-4">
            <AltekLogo className="h-12 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                {isViewingSelf ? 'My Timesheet' : `${viewedUserName}'s Timesheet`}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <MapPin className="h-3 w-3 text-emerald-500" />
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {currentDistance ? `${currentDistance.toFixed(1)}km from site` : 'Calculating distance...'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 px-6 py-2 bg-slate-50 rounded-lg border border-slate-100 shadow-sm">
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Normal</p>
              <p className="text-lg font-black text-slate-700">{(totals?.normal ?? 0).toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OT 1.5</p>
              <p className="text-lg font-black text-red-600">{(totals?.ot15 ?? 0).toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OT 2.0</p>
              <p className="text-lg font-black text-red-800">{(totals?.ot20 ?? 0).toFixed(1)}</p>
            </div>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="text-center">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Grand Total</p>
              <p className="text-lg font-black text-primary">{(totals?.total ?? 0).toFixed(1)} <span className="text-[10px] font-normal">hrs</span></p>
            </div>
          </div>

          <div className="flex items-end gap-3">
            {isElevated && !activeKioskUser && (
              <div className="flex flex-col gap-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Admin: View Employee</Label>
                <Select value={viewedUserId} onValueChange={setViewedUserId}>
                  <SelectTrigger className="w-[220px] bg-white font-bold border-primary/20 shadow-sm">
                    <SelectValue placeholder="Select Technician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers?.filter(u => 
                      u.role?.includes('Technician') || 
                      u.role?.includes('Engineer') || 
                      u.role?.includes('Technologist') ||
                      u.timesheetEnabled === true
                    ).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Payroll Cycle</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[200px] bg-slate-50 font-bold border-slate-200 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateMonthOptions().map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" onClick={() => window.print()} className="shadow-sm">
              <Printer className="w-4 h-4 mr-2" />Print
            </Button>
          </div>
        </header>

        <div className="hidden print:flex items-center justify-between mb-2 border-b border-black pb-1 print-header-row">
          <div>
            <h2 className="text-lg font-bold text-slate-800 print-user-name">{viewedUserName}</h2>
            <p className="text-[8pt] font-bold text-blue-600 uppercase">Period: {selectedPeriod}</p>
          </div>
          <div className="flex gap-4 text-center print-header-totals">
            <div><p className="text-[7pt] font-bold uppercase">NT</p><p className="text-sm font-bold">{(totals?.normal ?? 0).toFixed(1)}</p></div>
            <div><p className="text-[7pt] font-bold uppercase">OT 1.5</p><p className="text-sm font-bold text-red-600">{(totals?.ot15 ?? 0).toFixed(1)}</p></div>
            <div><p className="text-[7pt] font-bold uppercase">OT 2.0</p><p className="text-sm font-bold text-red-800">{(totals?.ot20 ?? 0).toFixed(1)}</p></div>
            <div className="border-l border-black pl-4"><p className="text-[7pt] font-bold uppercase">Total</p><p className="text-sm font-black text-primary">{(totals?.total ?? 0).toFixed(1)}</p></div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm print:border-black print:rounded-none">
          <Table className="min-w-full bg-white print:text-[7.5pt]">
            <TableHeader className="bg-slate-100 print:bg-slate-200">
              <TableRow className="hover:bg-transparent h-8 print:h-[20px]">
                <TableHead className="w-[100px] font-bold text-slate-600">Date/Day</TableHead>
                <TableHead className="w-[220px] font-bold text-slate-600 text-center">Normal Shift</TableHead>
                <TableHead className="w-[100px] font-bold text-slate-600 text-center">Lunch</TableHead>
                <TableHead className="w-[220px] font-bold text-red-700 text-center">Callout Shift</TableHead>
                <TableHead className="w-[50px] font-bold text-emerald-700 text-center">N/T</TableHead>
                <TableHead className="w-[50px] font-bold text-red-700 text-center">O/T</TableHead>
                <TableHead className="w-[120px] font-bold text-slate-600">Job Ref</TableHead>
                <TableHead className="w-[80px] font-bold text-slate-600 text-right">Sign-Off</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheet?.entries.map((entry, index) => {
                const dayDate = parseISO(entry.date);
                const isWeekend = getDay(dayDate) === 0 || getDay(dayDate) === 6;
                const now = new Date();
                const todayStr = format(now, 'yyyy-MM-dd');
                const yesterdayDate = new Date(now);
                yesterdayDate.setDate(now.getDate() - 1);
                const yesterdayStr = format(yesterdayDate, 'yyyy-MM-dd');

                const isToday = entry.date === todayStr;
                const isYesterday = entry.date === yesterdayStr;
                const isWithinGrace = now.getHours() < 9;

                const canClockNormal = isToday;
                const canClockCallout = isToday || (isYesterday && isWithinGrace);

                const calc = calculateRowHours(entry);
                const dayShifts = evaluatedStandbyWeeks.filter(w => entry.date >= w.startDate && entry.date < w.endDate);
                const isPrimaryOnDay = dayShifts.some(s => s.isPrimary);
                const isBackupOnDay = dayShifts.some(s => s.isBackup);

                return (
                  <TableRow key={entry.date} className={cn(isWeekend && "bg-slate-50/50", "h-8 print:h-[20px]")}>
                    <TableCell className="font-mono text-xs p-1">
                      <div className="font-bold">{entry.date}</div>
                      <div className={cn("text-[10px] uppercase", isWeekend ? "text-red-500" : "text-slate-400")}>{format(dayDate, 'EEEE')}</div>
                    </TableCell>
                    
                    <TableCell className={cn("p-1 relative", entry.isOutOfRange && "bg-red-50 print:bg-transparent")}>
                      {entry.isOutOfRange && (
                        <div className="absolute top-0 left-0 right-0 flex justify-center z-10 print:hidden">
                          <span className="bg-red-600 text-white text-[7px] font-black px-1 rounded-b flex items-center gap-0.5 shadow-sm animate-pulse">
                            <AlertTriangle className="h-2 w-2" /> OUT OF AREA
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-center">
                        {!isViewingSelf ? (
                            <div className="flex gap-1 items-center justify-center">
                              <input type="time" value={entry.normalIn || ''} onChange={(e) => handleEntryChange(index, 'normalIn', e.target.value)} className="h-8 text-xs p-1 w-20 border rounded print:hidden" disabled={!isElevated}/>
                              <span className="hidden print:block text-xs font-bold">{entry.normalIn || '--:--'}</span>
                              <span className="text-slate-300">-</span>
                              <input type="time" value={entry.normalOut || ''} onChange={(e) => handleEntryChange(index, 'normalOut', e.target.value)} className="h-8 text-xs p-1 w-20 border rounded print:hidden" disabled={!isElevated}/>
                              <span className="hidden print:block text-xs font-bold">{entry.normalOut || '--:--'}</span>
                            </div>
                        ) : (
                            entry.normalIn && entry.normalOut ? (
                              <div className="w-full text-center font-bold text-sm">
                                {entry.normalIn} - {entry.normalOut}
                              </div>
                            ) : (
                              <div className="flex gap-2 items-center justify-center">
                                {entry.normalIn ? <span className="text-sm font-bold">{entry.normalIn}</span> : <Button variant="outline" size="sm" className="h-8 text-[10px] px-2 print:hidden" onClick={() => handleRealTimeClock('IN', index)} disabled={!canClockNormal}>Clock In</Button>}
                                <span className="text-slate-300">-</span>
                                {entry.normalOut ? <span className="text-sm font-bold">{entry.normalOut}</span> : <Button variant="outline" size="sm" className="h-8 text-[10px] px-2 print:hidden" onClick={() => handleRealTimeClock('OUT', index)} disabled={!entry.normalIn || !canClockNormal}>Clock Out</Button>}
                              </div>
                            )
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="p-1">
                      <div className="flex gap-1 items-center justify-center">
                        <input type="time" value={entry.lunchOut || ''} onChange={(e) => handleEntryChange(index, 'lunchOut', e.target.value)} className="h-8 text-[10px] p-1 text-center w-16 border rounded print:hidden" disabled={!isElevated || !!activeKioskUser}/>
                        <span className="hidden print:block text-[10px] font-medium text-slate-600">{entry.lunchOut || '--:--'}</span>
                        <span className="text-slate-300">-</span>
                        <input type="time" value={entry.lunchIn || ''} onChange={(e) => handleEntryChange(index, 'lunchIn', e.target.value)} className="h-8 text-[10px] p-1 text-center w-16 border rounded print:hidden" disabled={!isElevated || !!activeKioskUser}/>
                        <span className="hidden print:block text-[10px] font-medium text-slate-600">{entry.lunchIn || '--:--'}</span>
                      </div>
                    </TableCell>

                    <TableCell className={cn("p-1 relative", entry.isOutOfRange && "bg-red-50 print:bg-transparent")}>
                      {entry.isOutOfRange && (
                        <div className="absolute top-0 left-0 right-0 flex justify-center z-10 print:hidden">
                          <span className="bg-red-600 text-white text-[7px] font-black px-1 rounded-b flex items-center gap-0.5 shadow-sm animate-pulse">
                            <AlertTriangle className="h-2 w-2" /> OUT OF AREA
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col gap-0 relative items-center justify-center print-stack-tight">
                        <div className="flex items-center justify-center">
                          {!isViewingSelf ? (
                            <div className="flex gap-1 items-center justify-center">
                              <input type="time" value={entry.calloutIn || ''} onChange={(e) => handleEntryChange(index, 'calloutIn', e.target.value)} className="h-8 text-xs p-1 w-20 border rounded print:hidden" disabled={!isElevated}/>
                              <span className="hidden print:block text-xs font-bold text-red-700">{entry.calloutIn || '--:--'}</span>
                              <span className="text-slate-300">-</span>
                              <input type="time" value={entry.calloutOut || ''} onChange={(e) => handleEntryChange(index, 'calloutOut', e.target.value)} className="h-8 text-xs p-1 w-20 border rounded print:hidden" disabled={!isElevated}/>
                              <span className="hidden print:block text-xs font-bold text-red-700">{entry.calloutOut || '--:--'}</span>
                            </div>
                          ) : (
                            entry.calloutIn && entry.calloutOut ? (
                              <div className="w-full text-center font-bold text-sm text-red-700">
                                {entry.calloutIn} - {entry.calloutOut}
                              </div>
                            ) : (
                              <div className="flex gap-2 items-center justify-center">
                                {entry.calloutIn ? <span className="text-sm font-bold text-red-700">{entry.calloutIn}</span> : <Button variant="outline" onClick={() => handleRealTimeClock('CIN', index)} disabled={!canClockCallout} className="h-8 text-[10px] px-2 print:hidden">In</Button>}
                                <span className="text-slate-300">-</span>
                                {entry.calloutOut ? <span className="text-sm font-bold text-red-700">{entry.calloutOut}</span> : <Button variant="outline" onClick={() => handleRealTimeClock('COUT', index)} disabled={!entry.calloutIn || !canClockCallout} className="h-8 text-[10px] px-2 print:hidden">Out</Button>}
                              </div>
                            )
                          )}
                        </div>
                        <div className="text-center mt-1 print:m-0">
                          {isPrimaryOnDay ? (<span className="text-[10px] font-bold text-blue-700 uppercase">Primary Standby</span>) : isBackupOnDay ? (<span className="text-[10px] font-bold text-orange-600 uppercase">Backup Standby</span>) : null}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-center font-bold text-emerald-700 p-1">{calc.calculatedNT || 0}</TableCell>
                    <TableCell className="text-center font-bold text-red-700 p-1">{(Number(calc.calculatedOT15 || 0) + Number(calc.calculatedOT20 || 0)).toFixed(1)}</TableCell>
                    <TableCell className="p-1">
                      <div className="space-y-1">
                        <Input value={entry.overtimeReason || ''} onChange={(e) => handleEntryChange(index, 'overtimeReason', e.target.value)} className="h-8 text-[10px] print:border-none print-input-cap" placeholder="Job Ref..." disabled={!isElevated && !canClockCallout}/>
                        
                        {entry.isOutOfRange && isElevated && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEntryChange(index, 'isOutOfRange', false)}
                            className="h-5 w-full text-[8px] font-bold text-red-600 hover:bg-red-50 border border-red-100 mt-1 print:hidden"
                          >
                            <CheckCircle2 className="h-2 w-2 mr-1" /> Clear GPS Flag
                          </Button>
                        )}

                        {entry.isOutOfRange && <div className="hidden print:block text-[6pt] text-red-600 font-bold uppercase italic">Flagged: {entry.distanceFromSite}km</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right p-1 print:p-0">
                      {entry.signature ? (
                        <div className="relative border rounded p-1 bg-slate-50 flex items-center justify-center group print:bg-white print:border-none print:p-0 print:sig-box">
                          <img src={entry.signature} alt="Signed" className="max-h-8 object-contain print:max-h-6" />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute -top-2 -right-2 h-5 w-5 bg-white border rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm print:hidden"
                            onClick={() => handleEntryChange(index, 'signature', null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="border rounded bg-white print:hidden h-10 overflow-hidden">
                          <SignaturePad onSave={(data) => handleEntryChange(index, 'signature', data)} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )})}
            </TableBody>
          </Table>
        </div>

        {/* --- CONDITIONAL STANDBY SUMMARY SECTION --- */}
        {standbyWeeksInCycle.length > 0 && (
          <div className="mt-16 space-y-4 print:mt-0 print-avoid-break print:page-break-before-always">
            <div className="flex flex-col gap-1 px-1">
              <h3 className="text-2xl font-bold text-emerald-800 flex items-center gap-3 uppercase tracking-tight">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                Standby Allowance Summary
              </h3>
            </div>

            <div className="overflow-hidden rounded-lg border-2 border-slate-200 shadow-sm bg-white print:border-black print:rounded-none">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-none h-14 print:h-8">
                    <TableHead className="pl-8 text-white font-black uppercase tracking-widest text-xs print:pl-2">SHIFT ROTATION PERIOD</TableHead>
                    <TableHead className="text-white font-black uppercase tracking-widest text-xs">DUTY DESIGNATION</TableHead>
                    <TableHead className="text-center text-white font-black uppercase tracking-widest text-xs">OT ACTIVITY</TableHead>
                    <TableHead className="text-right pr-8 text-white font-black uppercase tracking-widest text-xs print:pr-2">PAYROLL QUALIFICATION</TableHead>
                    {isElevated && <TableHead className="w-[100px] text-right pr-8">ACTIONS</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standbyWeeksInCycle.map((week) => {
                    const cycleEnd = dateRange.length > 0 ? endOfDay(new Date(dateRange[dateRange.length - 1])) : new Date();
                    const isNextCycle = week.exactEnd > cycleEnd;
                    
                    const weekOT = timesheet?.entries.reduce((acc, entry) => {
                      const entryDateStr = entry.date;
                      const isHandoverStart = entryDateStr === week.startDate;
                      const isHandoverEnd = entryDateStr === week.endDate;
                      const isCoreDay = entryDateStr > week.startDate && entryDateStr < week.endDate;

                      if (!isHandoverStart && !isHandoverEnd && !isCoreDay) return acc;

                      const calc = calculateRowHours(entry);
                      const dailyOT = (Number(calc.calculatedOT15 || 0) + Number(calc.calculatedOT20 || 0));

                      if (isCoreDay) return acc + dailyOT;

                      if (isHandoverStart) {
                        const outTime = entry.calloutOut || entry.normalOut;
                        if (outTime) {
                          const [h] = outTime.split(':').map(Number);
                          if (h >= 16) return acc + dailyOT;
                        }
                      }

                      if (isHandoverEnd) {
                        const inTime = entry.calloutIn || entry.normalIn;
                        if (inTime) {
                          const [h] = inTime.split(':').map(Number);
                          if (h < 9) return acc + dailyOT; 
                        }
                      }

                      return acc;
                    }, 0) || 0;

                    // OVERRIDE LOGIC
                    const overrideStatus = timesheet?.adminOverrides?.[week.id];
                    const autoQualifies = !isNextCycle && (week.isPrimary || (week.isBackup && weekOT > 0));
                    const qualifies = overrideStatus === 'QUALIFIED' ? true : (overrideStatus === 'DISQUALIFIED' ? false : autoQualifies);

                    return (
                      <TableRow key={week.id} className="h-16 border-b border-slate-100 last:border-0 hover:bg-slate-50/30 transition-colors print:h-10">
                        <TableCell className="pl-8 font-mono text-sm font-bold text-slate-700 print:pl-2 print:text-xs">
                          <div className="flex items-center gap-3"><div className="h-2 w-2 rounded-full bg-emerald-500" />{week.startDate} — {week.endDate}</div>
                        </TableCell>
                        <TableCell>
                          <div className={cn("inline-flex items-center px-4 py-1.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest", week.isPrimary ? "border-blue-700 text-blue-700" : "border-orange-600 text-orange-600")}>
                            {week.isPrimary ? "PRIMARY RESPONDER" : "BACKUP SUPPORT"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-slate-600 text-sm">{weekOT.toFixed(1)} hrs</TableCell>
                        <TableCell className="text-right pr-8 print:pr-2">
                          {isNextCycle ? (
                            <span className="inline-flex items-center gap-2 font-black text-blue-700 uppercase tracking-tighter text-sm">Next Cycle <Timer className="h-4 w-4" /></span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className={cn(
                                "inline-flex items-center gap-2 font-black uppercase tracking-tighter text-sm",
                                qualifies ? "text-emerald-600" : "text-slate-400"
                              )}>
                                {qualifies ? 'QUALIFIED' : 'NO ACTIVITY'}
                                {qualifies ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                              </span>
                              {overrideStatus && isElevated && (
                                <span className="text-[9px] font-bold text-red-600 uppercase flex items-center gap-1 mt-1">
                                  <ShieldCheck className="h-2 w-2" /> Admin Override Active
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        {isElevated && (
                          <TableCell className="text-right pr-8 print:hidden">
                            <Select 
                              value={overrideStatus || 'AUTO'} 
                              onValueChange={(val) => handleAdminOverride(week.id, val === 'AUTO' ? null : val as any)}
                            >
                              <SelectTrigger className="h-8 w-[120px] text-[10px] font-bold bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Override" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AUTO">Automatic</SelectItem>
                                <SelectItem value="QUALIFIED" className="text-emerald-600">Force Qualify</SelectItem>
                                <SelectItem value="DISQUALIFIED" className="text-red-600">Disqualify</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
