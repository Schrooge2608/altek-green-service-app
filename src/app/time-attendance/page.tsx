
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useDoc, useFirestore, useUser, useMemoFirebase, setDocumentNonBlocking, useCollection } from '@/firebase';
import type { Timesheet, TimesheetEntry, User as AppUser } from '@/lib/types';
import { doc, collection } from 'firebase/firestore';
import { format, subMonths, setDate, isBefore, addDays, getYear, setYear, setMonth, getMonth, add, differenceInHours, differenceInMinutes, parse } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
import { AltekLogo } from '@/components/altek-logo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/signature-pad';

const getTimesheetDates = (period: Date): Date[] => {
    const dates = [];
    const endDate = setDate(period, 22);
    let currentDate = setDate(subMonths(period, 1), 19);

    while (isBefore(currentDate, addDays(endDate, 1))) {
        dates.push(currentDate);
        currentDate = addDays(currentDate, 1);
    }
    return dates;
};

const years = Array.from({ length: 10 }, (_, i) => getYear(new Date()) - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: format(new Date(0, i), 'MMMM'),
}));

export default function TimeAttendancePage() {
  const { user: currentUser, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(currentUser?.uid);
  const [currentPeriod, setCurrentPeriod] = useState(() => new Date());
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<AppUser>(usersQuery);
  const { data: currentUserRole } = useDoc<AppUser>(useMemoFirebase(() => currentUser ? doc(firestore, 'users', currentUser.uid) : null, [firestore, currentUser]));
  const isManager = currentUserRole?.role && ['Admin', 'Superadmin', 'Site Supervisor', 'Services Manager'].includes(currentUserRole.role);

  const timesheetId = useMemo(() => {
      if (!selectedUserId) return null;
      return `${selectedUserId}_${format(currentPeriod, 'yyyy-MM')}`;
  }, [selectedUserId, currentPeriod]);

  const timesheetRef = useMemoFirebase(() => timesheetId ? doc(firestore, 'timesheets', timesheetId) : null, [timesheetId]);
  const { data: timesheetDoc, isLoading: timesheetLoading } = useDoc<Timesheet>(timesheetRef);
  
  const dates = useMemo(() => getTimesheetDates(currentPeriod), [currentPeriod]);
  
  useEffect(() => {
    if (currentUser && !selectedUserId) {
        setSelectedUserId(currentUser.uid);
    }
  }, [currentUser, selectedUserId]);

  useEffect(() => {
    const initialEntries = dates.map(date => {
      const existingEntry = timesheetDoc?.entries.find(e => e.date === format(date, 'yyyy-MM-dd'));
      return existingEntry || { date: format(date, 'yyyy-MM-dd') };
    });
    setTimesheetEntries(initialEntries);
  }, [dates, timesheetDoc]);

  const handleEntryChange = (date: string, field: keyof TimesheetEntry, value: any) => {
    setTimesheetEntries(prev => {
        return prev.map(entry => {
            if (entry.date === date) {
                const updatedEntry = { ...entry, [field]: value };
                
                // Auto-calculate hours
                if (['timeIn', 'timeOut', 'lunchIn', 'lunchOut'].includes(field)) {
                    const { timeIn, timeOut, lunchIn, lunchOut } = updatedEntry;
                    if (timeIn && timeOut) {
                        try {
                            const timeInDate = parse(timeIn, 'HH:mm', new Date());
                            const timeOutDate = parse(timeOut, 'HH:mm', new Date());
                            let totalMinutes = differenceInMinutes(timeOutDate, timeInDate);

                            if (lunchIn && lunchOut) {
                                const lunchInDate = parse(lunchIn, 'HH:mm', new Date());
                                const lunchOutDate = parse(lunchOut, 'HH:mm', new Date());
                                totalMinutes -= differenceInMinutes(lunchInDate, lunchOutDate);
                            }

                            const totalHours = totalMinutes / 60;
                            
                            if (totalHours > 9) {
                                updatedEntry.normalHrs = 9;
                                updatedEntry.overtimeHrs = parseFloat((totalHours - 9).toFixed(2));
                            } else {
                                updatedEntry.normalHrs = parseFloat(totalHours.toFixed(2));
                                updatedEntry.overtimeHrs = 0;
                            }
                        } catch (e) {
                            // ignore parse errors if time is incomplete
                        }
                    }
                }
                return updatedEntry;
            }
            return entry;
        });
    });
};


  const handleSave = async () => {
    if (!timesheetRef || !selectedUserId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot save timesheet. User or period not selected.' });
      return;
    }
    setIsSaving(true);
    const selectedUser = users?.find(u => u.id === selectedUserId);

    const dataToSave: Timesheet = {
      id: timesheetRef.id,
      userId: selectedUserId,
      userName: selectedUser?.name || 'Unknown User',
      period: format(currentPeriod, 'yyyy-MM'),
      entries: timesheetEntries,
    };
    
    await setDocumentNonBlocking(timesheetRef, dataToSave, { merge: true });
    setIsSaving(false);
    toast({ title: 'Timesheet Saved', description: 'Your timesheet has been updated.' });
  };
  
  const totalNormalHours = useMemo(() => timesheetEntries.reduce((sum, entry) => sum + (entry.normalHrs || 0), 0), [timesheetEntries]);
  const totalOvertimeHours = useMemo(() => timesheetEntries.reduce((sum, entry) => sum + (entry.overtimeHrs || 0), 0), [timesheetEntries]);

  const isLoading = isUserLoading || usersLoading || timesheetLoading;

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <AltekLogo className="h-10" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">ALTEK GREEN TIMESHEET</h1>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={String(getMonth(currentPeriod))} onValueChange={(m) => setCurrentPeriod(setMonth(currentPeriod, Number(m)))}>
                  <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                      {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                  </SelectContent>
              </Select>
              <Select value={String(getYear(currentPeriod))} onValueChange={(y) => setCurrentPeriod(setYear(currentPeriod, Number(y)))}>
                  <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                      {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {isManager ? (
                <div className="space-y-1">
                    <Label>Employee</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={usersLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                </div>
              ) : (
                 <div className="space-y-1">
                    <Label>Employee</Label>
                    <Input value={currentUserRole?.name || ''} disabled />
                </div>
              )}
               <div className="space-y-1">
                    <Label>Name</Label>
                    <Input value="AG" disabled />
                </div>
            </div>
            {isLoading ? (
                 <div className="flex items-center justify-center h-96">
                    <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                    <span>Loading timesheet...</span>
                </div>
            ) : (
                <Table className="border">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">DATE</TableHead>
                            <TableHead className="w-[120px]">DAY</TableHead>
                            <TableHead>TIME IN</TableHead>
                            <TableHead>LUNCH OUT</TableHead>
                            <TableHead>LUNCH IN</TableHead>
                            <TableHead>TIME OUT</TableHead>
                            <TableHead>NORMAL HRS</TableHead>
                            <TableHead>OVERTIME HRS</TableHead>
                            <TableHead>OVERTIME REASON</TableHead>
                            <TableHead>SIGNATURE</TableHead>
                            <TableHead>COMMENTS</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dates.map((date, index) => {
                            const entry = timesheetEntries.find(e => e.date === format(date, 'yyyy-MM-dd')) || { date: format(date, 'yyyy-MM-dd') };
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            return (
                            <TableRow key={index} className={isWeekend ? 'bg-muted/50' : ''}>
                                <TableCell>{format(date, 'yyyy-MM-dd')}</TableCell>
                                <TableCell>{format(date, 'eeee')}</TableCell>
                                <TableCell><Input type="time" value={entry.timeIn || ''} onChange={(e) => handleEntryChange(entry.date, 'timeIn', e.target.value)} /></TableCell>
                                <TableCell><Input type="time" value={entry.lunchOut || ''} onChange={(e) => handleEntryChange(entry.date, 'lunchOut', e.target.value)} /></TableCell>
                                <TableCell><Input type="time" value={entry.lunchIn || ''} onChange={(e) => handleEntryChange(entry.date, 'lunchIn', e.target.value)} /></TableCell>
                                <TableCell><Input type="time" value={entry.timeOut || ''} onChange={(e) => handleEntryChange(entry.date, 'timeOut', e.target.value)} /></TableCell>
                                <TableCell><Input type="number" value={entry.normalHrs || ''} onChange={(e) => handleEntryChange(entry.date, 'normalHrs', e.target.value)} /></TableCell>
                                <TableCell><Input type="number" value={entry.overtimeHrs || ''} onChange={(e) => handleEntryChange(entry.date, 'overtimeHrs', e.target.value)} /></TableCell>
                                <TableCell><Input value={entry.overtimeReason || ''} onChange={(e) => handleEntryChange(entry.date, 'overtimeReason', e.target.value)} /></TableCell>
                                <TableCell>
                                    <SignaturePad 
                                        value={entry.signature}
                                        onSign={(dataUrl) => handleEntryChange(entry.date, 'signature', dataUrl)}
                                        onClear={() => handleEntryChange(entry.date, 'signature', null)}
                                    />
                                </TableCell>
                                <TableCell><Input value={entry.comments || ''} onChange={(e) => handleEntryChange(entry.date, 'comments', e.target.value)} /></TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                     <TableFooter>
                        <TableRow>
                            <TableCell colSpan={6} className="text-right font-bold">Totals</TableCell>
                            <TableCell><Input value={totalNormalHours.toFixed(2)} readOnly className="font-bold" /></TableCell>
                            <TableCell><Input value={totalOvertimeHours.toFixed(2)} readOnly className="font-bold" /></TableCell>
                            <TableCell colSpan={3}></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            )}
            <div className="flex justify-end mt-4">
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Timesheet
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}


    