

'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  TableFooter,
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
  setDocumentNonBlocking,
  useUser,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Timesheet, TimesheetEntry, User } from '@/lib/types';
import React, { useState, useEffect, useMemo } from 'react';
import {
  subMonths,
  addMonths,
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  setDate,
} from 'date-fns';
import { Loader2, Save, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

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

export default function TimeAttendancePage() {
  const firestore = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const { toast } = useToast();

  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    format(new Date(), 'yyyy-MM')
  );
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const usersQuery = useMemoFirebase(
    () => collection(firestore, 'users'),
    [firestore]
  );
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const timesheetId = useMemo(() => {
    if (!user || !selectedPeriod) return null;
    return `${user.uid}_${selectedPeriod}`;
  }, [user, selectedPeriod]);

  // Temporarily disable fetching to avoid permission errors. We will re-enable this later.
  const fetchedTimesheet = null;
  const timesheetLoading = false;
  
  const dateRange = useMemo(() => {
    const [year, month] = selectedPeriod.split('-').map(Number);
    // Use UTC to avoid timezone shifts affecting the month.
    const targetMonthDate = new Date(Date.UTC(year, month - 1, 1));
    const prevMonth = subMonths(targetMonthDate, 1);
    const start = setDate(prevMonth, 19);
    const end = setDate(targetMonthDate, 22);
    return eachDayOfInterval({ start, end });
  }, [selectedPeriod]);
  
  useEffect(() => {
    if (timesheetLoading || !dateRange.length || !user) return;

    // This logic now only runs to create a *new* timesheet, since fetching is disabled.
    const entriesMap = new Map(fetchedTimesheet?.entries.map((e) => [e.date, e]));
    const newEntries: TimesheetEntry[] = dateRange.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const existingEntry = entriesMap.get(dateStr);
      return existingEntry || { date: dateStr };
    });

    const selectedUser = users?.find((u) => u.id === user.uid);
    const newTimesheet: Timesheet = {
      id: timesheetId || `${user.uid}_${selectedPeriod}`,
      userId: user.uid,
      userName: selectedUser?.name || '',
      period: selectedPeriod,
      entries: newEntries,
    };

    setTimesheet(newTimesheet);
  }, [
    fetchedTimesheet,
    timesheetLoading,
    dateRange,
    user,
    selectedPeriod,
    timesheetId,
    users,
  ]);

  const currentUserName = useMemo(() => {
    if (!users || !user) return '';
    return users.find(u => u.id === user.uid)?.name || user.displayName || 'Loading...';
  }, [users, user]);


  const handleEntryChange = (
    index: number,
    field: keyof TimesheetEntry,
    value: any
  ) => {
    if (!timesheet) return;
    const newEntries = [...timesheet.entries];
    // @ts-ignore
    newEntries[index][field] = value;
    setTimesheet({ ...timesheet, entries: newEntries });
  };

  const handleSave = async () => {
    if (!timesheet || !timesheetId) return;
    const timesheetRef = doc(firestore, 'timesheets', timesheetId);
    setIsLoading(true);
    try {
      await setDocumentNonBlocking(timesheetRef, { ...timesheet }, { merge: true });
      toast({
        title: 'Timesheet Saved',
        description: `The timesheet for ${
          timesheet.userName
        } for ${format(new Date(selectedPeriod), 'MMMM yyyy')} has been saved.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Saving',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totals = useMemo(() => {
    if (!timesheet) return { normal: 0, overtime: 0, total: 0 };
    return timesheet.entries.reduce(
      (acc, entry) => {
        const normal = Number(entry.normalHrs || 0);
        const overtime = Number(entry.overtimeHrs || 0);
        acc.normal += normal;
        acc.overtime += overtime;
        acc.total += normal + overtime;
        return acc;
      },
      { normal: 0, overtime: 0, total: 0 }
    );
  }, [timesheet]);

  if (isAuthLoading || usersLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8">
      <Card className="p-8 shadow-lg print:shadow-none print:border-none">
        <header className="flex items-center justify-between mb-4 border-b pb-4 print:border-black">
          <AltekLogo className="h-12 w-auto" />
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            ALTEK GREEN TIMESHEET
          </h1>
          <div className="text-right">
            <Label htmlFor="month-select">Month</Label>
            <Select
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
            >
              <SelectTrigger id="month-select" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {generateMonthOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="employee-name">Name</Label>
            <Input id="employee-name" value={currentUserName} readOnly disabled />
          </div>
          <div className="flex justify-end items-end gap-2 print:hidden">
            <Button
              onClick={handleSave}
              disabled={isLoading || timesheetLoading}
            >
              {isLoading || timesheetLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Timesheet
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px] py-1 px-2 h-auto">Date</TableHead>
                <TableHead className="w-[100px] py-1 px-2 h-auto">Day</TableHead>
                <TableHead className="w-[60px] py-1 px-2 h-auto">Time In</TableHead>
                <TableHead className="w-[60px] py-1 px-2 h-auto">Lunch Out</TableHead>
                <TableHead className="w-[60px] py-1 px-2 h-auto">Lunch In</TableHead>
                <TableHead className="w-[60px] py-1 px-2 h-auto">Time Out</TableHead>
                <TableHead className="w-[60px] py-1 px-2 h-auto">Normal Hrs</TableHead>
                <TableHead className="w-[60px] py-1 px-2 h-auto">Overtime Hrs</TableHead>
                <TableHead className="w-[70px] py-1 px-2 h-auto">Total Hrs</TableHead>
                <TableHead className="py-1 px-2 h-auto">Overtime Reason</TableHead>
                <TableHead className="w-[60px] py-1 px-2 h-auto">Signature</TableHead>
                <TableHead className="py-1 px-2 h-auto">Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheetLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-48 text-center py-1 px-2">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : (
                timesheet?.entries.map((entry, index) => {
                  const totalDailyHours = (Number(entry.normalHrs) || 0) + (Number(entry.overtimeHrs) || 0);
                  return (
                  <TableRow key={entry.date}>
                    <TableCell className="py-1 px-2">
                      {format(new Date(entry.date), 'yyyy-MM-dd')}
                    </TableCell>
                    <TableCell className="py-1 px-2">{format(new Date(entry.date), 'EEE')}</TableCell>
                    <TableCell className="py-1 px-2">
                      <Input
                        type="time"
                        value={entry.timeIn || ''}
                        onChange={(e) =>
                          handleEntryChange(index, 'timeIn', e.target.value)
                        }
                        className="h-8 py-1 px-2 text-xs"
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <Input
                        type="time"
                        value={entry.lunchOut || ''}
                        onChange={(e) =>
                          handleEntryChange(index, 'lunchOut', e.target.value)
                        }
                        className="h-8 py-1 px-2 text-xs"
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <Input
                        type="time"
                        value={entry.lunchIn || ''}
                        onChange={(e) =>
                          handleEntryChange(index, 'lunchIn', e.target.value)
                        }
                        className="h-8 py-1 px-2 text-xs"
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <Input
                        type="time"
                        value={entry.timeOut || ''}
                        onChange={(e) =>
                          handleEntryChange(index, 'timeOut', e.target.value)
                        }
                        className="h-8 py-1 px-2 text-xs"
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={entry.normalHrs || ''}
                        onChange={(e) =>
                          handleEntryChange(index, 'normalHrs', e.target.value)
                        }
                        className="h-8 py-1 px-1 text-[10px]"
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={entry.overtimeHrs || ''}
                        onChange={(e) =>
                          handleEntryChange(index, 'overtimeHrs', e.target.value)
                        }
                        className="h-8 py-1 px-1 text-[10px]"
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                        <Input
                            type="number"
                            step="0.1"
                            value={totalDailyHours > 0 ? totalDailyHours.toFixed(2) : ''}
                            readOnly
                            className="font-bold bg-muted h-8 py-1 px-1 text-[10px]"
                        />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <Input
                        value={entry.overtimeReason || ''}
                        onChange={(e) =>
                          handleEntryChange(
                            index,
                            'overtimeReason',
                            e.target.value
                          )
                        }
                        className="h-8 py-1 px-2 text-xs"
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <SignaturePad
                        value={entry.signature}
                        onSign={(dataUrl) =>
                          handleEntryChange(index, 'signature', dataUrl)
                        }
                        onClear={() =>
                          handleEntryChange(index, 'signature', null)
                        }
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <Input
                        value={entry.comments || ''}
                        onChange={(e) =>
                          handleEntryChange(index, 'comments', e.target.value)
                        }
                        className="h-8 py-1 px-2 text-xs"
                      />
                    </TableCell>
                  </TableRow>
                )})
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-right font-bold py-1 px-2">
                  Totals
                </TableCell>
                <TableCell className="py-1 px-2">
                  <Input
                    value={totals.normal.toFixed(2)}
                    readOnly
                    className="font-bold bg-muted h-8 py-1 px-1 text-[10px]"
                  />
                </TableCell>
                <TableCell className="py-1 px-2">
                  <Input
                    value={totals.overtime.toFixed(2)}
                    readOnly
                    className="font-bold bg-muted h-8 py-1 px-1 text-[10px]"
                  />
                </TableCell>
                <TableCell className="py-1 px-2">
                  <Input
                    value={totals.total.toFixed(2)}
                    readOnly
                    className="font-bold bg-muted h-8 py-1 px-1 text-[10px]"
                  />
                </TableCell>
                <TableCell colSpan={3} className="py-1 px-2"></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Card>
    </div>
  );
}
