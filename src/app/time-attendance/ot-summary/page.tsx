'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Loader2, 
  Printer, 
  ShieldAlert,
  Users
} from 'lucide-react';
import { 
  useCollection, 
  useFirebase, 
  useMemoFirebase, 
  useUser,
  useDoc
} from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import type { Timesheet, User, TimesheetEntry, StandbyShift } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { format, addMonths } from 'date-fns';
import { AltekLogo } from '@/components/altek-logo';
import { Label } from '@/components/ui/label';
import { getPayrollPeriod, getDefaultPayrollMonth } from '@/lib/payroll-utils';

// Standardized Duration Helper: Supports Midnight Rollover
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
  if (!row.date) return { calculatedNT: 0, calculatedOT15: 0, calculatedOT20: 0 };

  const rowDate = new Date(row.date);
  const dayOfWeek = rowDate.getDay(); 
  let grossShift = getDuration(row.normalIn, row.normalOut);
  let lunchBreak = getDuration(row.lunchOut, row.lunchIn);
  let calloutDuration = getDuration(row.calloutIn, row.calloutOut);
  
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && grossShift >= 6 && lunchBreak === 0) {
    lunchBreak = 0.5;
  }
  
  let netNormalShift = Math.max(0, grossShift - lunchBreak);
  let nt = 0;
  let ot15 = 0;
  let ot20 = 0;
  
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
    calculatedNT: Number(nt.toFixed(1)), 
    calculatedOT15: Number(ot15.toFixed(1)), 
    calculatedOT20: Number(ot20.toFixed(1)) 
  };
};

function generateMonthOptions() {
  const options = [];
  const today = new Date();
  for (let i = -6; i <= 6; i++) {
    const date = addMonths(today, i);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    });
  }
  return options;
}

export default function OTSummaryPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const router = useRouter();
  
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  useEffect(() => {
    // Set dynamic default period based on Altek rollover rules
    setSelectedPeriod(getDefaultPayrollMonth());
  }, []);

  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData, isLoading: userLoading } = useDoc<User>(userRef);

  const isManagement = useMemo(() => {
    if (!userData?.role) return false;
    const managementRoles = ['Admin', 'Superadmin', 'Client Manager', 'Corporate Manager', 'Services Manager', 'Data Admin'];
    return managementRoles.some(role => userData.role.includes(role));
  }, [userData]);

  const timesheetsQuery = useMemoFirebase(
    () => {
      if (!selectedPeriod) return null;
      return query(collection(firestore, 'timesheets'), where('period', '==', selectedPeriod));
    },
    [firestore, selectedPeriod]
  );
  const { data: timesheets, isLoading: tsLoading } = useCollection<Timesheet>(timesheetsQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const standbyQuery = useMemoFirebase(
    () => query(collection(firestore, 'standby_shifts'), orderBy('startDate', 'asc')),
    [firestore]
  );
  const { data: standbyShifts, isLoading: standbyLoading } = useCollection<StandbyShift>(standbyQuery);

  const summaryData = useMemo(() => {
    if (!allUsers || !timesheets || !standbyShifts || !selectedPeriod) return [];

    const { periodStart, periodEnd } = getPayrollPeriod(selectedPeriod);
    const now = new Date();

    return allUsers.map(u => {
      const userTimesheet = timesheets.find(ts => ts.userId === u.id);
      
      let totalNT = 0;
      let totalOT15 = 0;
      let totalOT20 = 0;
      let stbaHours = 0;

      if (userTimesheet?.entries) {
        userTimesheet.entries.forEach(entry => {
          const { calculatedNT, calculatedOT15, calculatedOT20 } = calculateRowHours(entry);
          totalNT += calculatedNT;
          totalOT15 += calculatedOT15;
          totalOT20 += calculatedOT20;
        });
      }

      const qualifiedStandbyWeeks = standbyShifts
        .filter(shift => {
          const shiftEnd = new Date(shift.endDate);
          shiftEnd.setHours(7, 0, 0, 0);
          const isFinished = now >= shiftEnd;
          return shiftEnd >= periodStart && shiftEnd <= periodEnd && isFinished;
        })
        .filter(shift => {
          const isPrimary = shift.primaryTech === u.name;
          const isBackup = shift.backupTech === u.name;
          if (isPrimary) return true;
          if (isBackup) {
            const shiftStart = new Date(shift.startDate);
            const shiftEnd = new Date(shift.endDate);
            return userTimesheet?.entries?.some(entry => {
              const d = new Date(entry.date);
              if (d >= shiftStart && d <= shiftEnd) {
                const { calculatedOT15, calculatedOT20 } = calculateRowHours(entry);
                return calculatedOT15 > 0 || calculatedOT20 > 0;
              }
              return false;
            });
          }
          return false;
        });

      stbaHours = qualifiedStandbyWeeks.length * 12;

      return {
        id: u.id,
        name: u.name,
        role: u.role,
        totalNT: Number(totalNT.toFixed(1)),
        totalOT15: Number(totalOT15.toFixed(1)),
        totalOT20: Number(totalOT20.toFixed(1)),
        stba: stbaHours,
        totalHours: Number((totalNT + totalOT15 + totalOT20).toFixed(1)),
        hasData: !!userTimesheet
      };
    }).filter(item => item.hasData || item.totalHours > 0 || item.stba > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsers, timesheets, standbyShifts, selectedPeriod]);

  const grandTotals = useMemo(() => {
    return summaryData.reduce((acc, curr) => ({
      normal: acc.normal + curr.totalNT,
      ot15: acc.ot15 + curr.totalOT15,
      ot20: acc.ot20 + curr.totalOT20,
      stba: acc.stba + curr.stba,
      total: acc.total + curr.totalHours
    }), { normal: 0, ot15: 0, ot20: 0, stba: 0, total: 0 });
  }, [summaryData]);

  if (userLoading || !selectedPeriod) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  if (!isManagement) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">Management Only Dashboard.</p>
        <Button onClick={() => router.push('/')} className="mt-6">Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 pb-20">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">Management: OT Summary</h1>
          <p className="text-muted-foreground italic">Aggregated monthly overtime activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">Cycle</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[200px] bg-white font-bold border-slate-200 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {generateMonthOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => window.print()} className="mt-4 md:mt-0 shadow-sm"><Printer className="h-4 w-4 mr-2" />Print</Button>
        </div>
      </header>

      <div className="hidden print:flex items-center justify-between mb-8 border-b-2 pb-6 border-slate-900">
        <div className="flex items-center gap-4">
          <AltekLogo className="h-14 w-auto" />
          <div><h1 className="text-2xl font-black uppercase">Site OT Summary</h1><p className="text-sm font-bold text-blue-600">Period: {selectedPeriod}</p></div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-xl overflow-hidden print:border-black print:shadow-none">
        <CardContent className="p-0">
          <Table className="print:text-[11px]">
            <TableHeader className="bg-slate-100 print:bg-slate-200">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 font-black text-slate-700 uppercase tracking-wider">Employee Name</TableHead>
                <TableHead className="font-bold text-slate-500 uppercase text-[10px]">Position</TableHead>
                <TableHead className="text-center font-bold text-emerald-700 uppercase text-[10px] bg-emerald-50/30">N/T Hours</TableHead>
                <TableHead className="text-center font-bold text-red-600 uppercase text-[10px] bg-red-50/30">OT 1.5</TableHead>
                <TableHead className="text-center font-bold text-red-800 uppercase text-[10px] bg-red-100/30">OT 2.0</TableHead>
                <TableHead className="text-center font-bold text-amber-700 uppercase text-[10px] bg-amber-50/30">STBA (12h)</TableHead>
                <TableHead className="text-right pr-6 font-black text-slate-900 uppercase tracking-wider">Gross Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tsLoading || usersLoading || standbyLoading ? (
                <TableRow><TableCell colSpan={7} className="h-64 text-center">Loading activity logs...</TableCell></TableRow>
              ) : summaryData.length > 0 ? (
                summaryData.map((row) => (
                  <TableRow key={row.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 print:border-black">
                    <TableCell className="pl-6 font-black text-slate-800">{row.name}</TableCell>
                    <TableCell className="text-[11px] text-slate-500 font-medium italic">{row.role}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-emerald-700">{row.totalNT}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-red-600">{row.totalOT15}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-red-800">{row.totalOT20}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-amber-700">{row.stba}</TableCell>
                    <TableCell className="text-right pr-6 font-black text-slate-900 text-base">{row.totalHours} <span className="text-[10px] font-normal text-slate-400">HRS</span></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="h-48 text-center text-slate-400">No data found.</TableCell></TableRow>
              )}
            </TableBody>
            {summaryData.length > 0 && (
              <TableFooter className="bg-slate-100 print:bg-slate-300 print:border-t-2 print:border-black">
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2} className="pl-6 text-slate-900 font-black uppercase text-xs">Totals</TableCell>
                  <TableCell className="text-center text-emerald-800 font-black">{grandTotals.normal.toFixed(1)}</TableCell>
                  <TableCell className="text-center text-red-700 font-black">{grandTotals.ot15.toFixed(1)}</TableCell>
                  <TableCell className="text-center text-red-900 font-black">{grandTotals.ot20.toFixed(1)}</TableCell>
                  <TableCell className="text-center text-amber-800 font-black">{grandTotals.stba.toFixed(1)}</TableCell>
                  <TableCell className="text-right pr-6 text-primary text-xl font-black">{grandTotals.total.toFixed(1)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
