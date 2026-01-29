
'use client';

import React, { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, CheckCircle, Calendar as CalendarIcon, Trash2, Loader2, X, Eye, Pencil, Activity, AlertTriangle } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, useUser, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDoc, runTransaction, query, orderBy } from 'firebase/firestore';
import type { Breakdown, Equipment, User as AppUser } from '@/lib/types';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


function ResolveBreakdownDialog({ breakdown, onResolve, children }: { breakdown: Breakdown, onResolve: (b: Breakdown, resolutionDetails: {resolution: string, normal: number, overtime: number, timeBackInService: Date}) => void, children: React.ReactNode }) {
  const [resolution, setResolution] = React.useState('');
  const [normalHours, setNormalHours] = React.useState(0);
  const [overtimeHours, setOvertimeHours] = React.useState(0);
  const [timeBackInService, setTimeBackInService] = React.useState<Date | undefined>();

  const handleResolveClick = () => {
    if (!timeBackInService) {
        // Ideally, show a toast or message to the user
        console.error("Time back in service is required.");
        return;
    }
    onResolve(breakdown, { resolution, normal: normalHours, overtime: overtimeHours, timeBackInService });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resolve Breakdown for {breakdown.equipmentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the issue as resolved. Please enter the hours spent and time the equipment was back in service. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="resolution" className="text-right pt-2">
                    Resolution Notes
                </Label>
                <Textarea
                    id="resolution"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="col-span-3"
                    placeholder="Describe the fix, parts used, and root cause..."
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="normal-hours" className="text-right">
                    Normal Hours
                </Label>
                <Input
                    id="normal-hours"
                    type="number"
                    value={normalHours}
                    onChange={(e) => setNormalHours(Number(e.target.value))}
                    className="col-span-3"
                />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="overtime-hours" className="text-right">
                    Overtime Hours
                </Label>
                <Input
                    id="overtime-hours"
                    type="number"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(Number(e.target.value))}
                    className="col-span-3"
                />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="time-back" className="text-right">
                    Back in Service
                </Label>
                 <Popover>
                      <PopoverTrigger asChild>
                          <Button
                            id="time-back"
                            variant={"outline"}
                            className={cn(
                              "col-span-3 justify-start text-left font-normal",
                              !timeBackInService && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {timeBackInService ? format(timeBackInService, "PPP HH:mm") : <span>Pick date and time</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={timeBackInService}
                          onSelect={setTimeBackInService}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
            </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleResolveClick} disabled={!timeBackInService || !resolution}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


export default function BreakdownsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const router = useRouter();

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userRole, isLoading: userRoleLoading } = useDoc<AppUser>(userRoleRef);
  
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<AppUser>(usersQuery);

  const breakdownsQuery = useMemoFirebase(() => query(collection(firestore, 'breakdown_reports'), orderBy('timeReported', 'desc')), [firestore]);
  const { data: breakdowns, isLoading: breakdownsLoading } = useCollection<Breakdown>(breakdownsQuery);

  const isLoading = breakdownsLoading || isUserLoading || userRoleLoading || usersLoading;
  const isClientManager = userRole?.role === 'Client Manager';
  const canDelete = userRole?.role && (userRole.role.includes('Admin') || userRole.role.includes('Superadmin'));

  const filteredBreakdowns = useMemo(() => {
    if (!breakdowns) return [];
    if (!dateRange?.from) return breakdowns;

    const fromDate = startOfDay(dateRange.from);
    const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

    return breakdowns.filter(b => {
        if (!b.timeReported) return false;
        try {
            const reportedDate = new Date(b.timeReported);
            return reportedDate >= fromDate && reportedDate <= toDate;
        } catch (e) {
            return false;
        }
    });
  }, [breakdowns, dateRange]);
  
  const activeBreakdowns = useMemo(() => filteredBreakdowns.filter(b => !b.resolved), [filteredBreakdowns]);
  const resolvedBreakdowns = useMemo(() => {
      const userNameMap = new Map(users?.map(u => [u.id, u.name]));
      return filteredBreakdowns
        .filter(b => b.resolved)
        .map(b => ({
            ...b,
            creatorName: userNameMap.get(b.userId || '') || 'Unknown',
        }));
  }, [filteredBreakdowns, users]);
  
   const kpiData = useMemo(() => {
    if (!breakdowns) return { month: 0, year: 0 };
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const yearStart = startOfYear(now);
    const yearEnd = endOfYear(now);

    let monthCount = 0;
    let yearCount = 0;

    breakdowns.forEach(b => {
        if (b.resolved && b.timeBackInService) {
            try {
                const resolvedDate = new Date(b.timeBackInService);
                if (isWithinInterval(resolvedDate, { start: monthStart, end: monthEnd })) {
                    monthCount++;
                }
                if (isWithinInterval(resolvedDate, { start: yearStart, end: yearEnd })) {
                    yearCount++;
                }
            } catch (e) {
                // Ignore invalid dates
            }
        }
    });

    return { month: monthCount, year: yearCount };
  }, [breakdowns]);


  const handleResolve = async (breakdown: Breakdown, resolutionDetails: {resolution: string, normal: number, overtime: number, timeBackInService: Date}) => {
    const breakdownRef = doc(firestore, 'breakdown_reports', breakdown.id);
    const equipmentRef = doc(firestore, 'equipment', breakdown.equipmentId);

    let downtimeHours = 0;
    if (breakdown.timeReported && resolutionDetails.timeBackInService) {
        const downtimeMillis = resolutionDetails.timeBackInService.getTime() - new Date(breakdown.timeReported).getTime();
        downtimeHours = downtimeMillis / (1000 * 60 * 60);
    }
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const eqDoc = await transaction.get(equipmentRef);
            if (!eqDoc.exists()) {
                throw "Equipment document not found!";
            }
            const eqData = eqDoc.data() as Equipment;
            const currentDowntime = eqData.totalDowntimeHours || 0;
            const newTotalDowntime = currentDowntime + downtimeHours;
            transaction.update(equipmentRef, { totalDowntimeHours: newTotalDowntime });
        });
    } catch (e) {
        console.error("Failed to update equipment downtime in transaction: ", e);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "Could not update the equipment's downtime. The breakdown status was not updated.",
        });
        return;
    }

    updateDocumentNonBlocking(breakdownRef, { 
        resolved: true,
        resolution: resolutionDetails.resolution,
        normalHours: resolutionDetails.normal,
        overtimeHours: resolutionDetails.overtime,
        timeBackInService: resolutionDetails.timeBackInService.toISOString(),
    });

    toast({
        title: "Breakdown Resolved",
        description: `The issue for ${breakdown.equipmentName} has been marked as resolved.`,
    });
  }

  const handleDeleteBreakdown = (breakdown: Breakdown) => {
    const breakdownRef = doc(firestore, 'breakdown_reports', breakdown.id);
    deleteDocumentNonBlocking(breakdownRef);
    toast({
        title: 'Breakdown Report Deleted',
        description: `The report for ${breakdown.equipmentName} has been removed.`,
    });
  }
  
  const formatDate = (dateString?: string) => {
      if (!dateString) return 'N/A';
      try {
          return format(new Date(dateString), 'yyyy-MM-dd HH:mm');
      } catch (e) {
          return dateString;
      }
  }


  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Breakdown Log</h1>
          <p className="text-muted-foreground">
            View active issues or browse the history of all reported breakdowns.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("w-full md:w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
            {dateRange && (<Button variant="ghost" onClick={() => setDateRange(undefined)}><X className="mr-2 h-4 w-4"/>Clear</Button>)}
            <Link href="/breakdowns/new" passHref>
            <Button variant="destructive">
                <PlusCircle className="mr-2 h-4 w-4" />
                Report New
            </Button>
            </Link>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Breakdowns This Month</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{isLoading ? <Loader2 className="animate-spin h-6 w-6"/> : kpiData.month}</div>
                  <p className="text-xs text-muted-foreground">resolved in the current calendar month</p>
              </CardContent>
          </Card>
           <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Breakdowns Year-to-Date</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{isLoading ? <Loader2 className="animate-spin h-6 w-6"/> : kpiData.year}</div>
                  <p className="text-xs text-muted-foreground">resolved since Jan 1st</p>
              </CardContent>
          </Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
            <TabsTrigger value="active">Active ({activeBreakdowns.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({resolvedBreakdowns.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
            <Card>
                <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Time Reported</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Component</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center h-24"><div className='flex justify-center items-center'><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading breakdowns...</div></TableCell></TableRow>
                    ) : activeBreakdowns && activeBreakdowns.length > 0 ? (
                        activeBreakdowns.map((b) => (
                            <TableRow key={b.id}>
                                <TableCell>{formatDate(b.timeReported)}</TableCell>
                                <TableCell className="font-medium">
                                    <Link href={`/equipment/${b.equipmentId}`} className="hover:underline text-primary">{b.equipmentName}</Link>
                                </TableCell>
                                <TableCell>{b.component}</TableCell>
                                <TableCell><Badge variant='destructive'>Pending</Badge></TableCell>
                                <TableCell className="text-right">
                                    <div className='flex items-center justify-end gap-2'>
                                        <Button variant="outline" size="sm" onClick={() => router.push(`/breakdowns/${b.id}`)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                                        {!isClientManager && (
                                            <ResolveBreakdownDialog breakdown={b} onResolve={handleResolve}>
                                                <Button variant="ghost" size="sm"><CheckCircle className="mr-2 h-4 w-4" />Resolved</Button>
                                            </ResolveBreakdownDialog>
                                        )}
                                        {canDelete && (
                                            <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete Report</span></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the report for <strong>{b.equipmentName}</strong>.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={() => handleDeleteBreakdown(b)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={5} className="text-center h-24">No active breakdowns found{dateRange?.from ? ' for the selected date range' : ''}.</TableCell></TableRow>
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="resolved">
            <Card>
                <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Date Resolved</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Reported By</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={5} className="text-center h-24"><div className='flex justify-center items-center'><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading breakdowns...</div></TableCell></TableRow>
                    ) : resolvedBreakdowns && resolvedBreakdowns.length > 0 ? (
                        resolvedBreakdowns.map((b) => (
                            <TableRow key={b.id}>
                                <TableCell>{formatDate(b.timeBackInService)}</TableCell>
                                <TableCell className="font-medium">
                                    <Link href={`/equipment/${b.equipmentId}`} className="hover:underline text-primary">{b.equipmentName}</Link>
                                </TableCell>
                                <TableCell>{b.creatorName}</TableCell>
                                <TableCell className="text-right">{(b.normalHours ?? 0) + (b.overtimeHours ?? 0)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => router.push(`/breakdowns/${b.id}`)}><Eye className="mr-2 h-4 w-4" /> View</Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={5} className="text-center h-24">No resolved breakdowns found{dateRange?.from ? ' for the selected date range' : ''}.</TableCell></TableRow>
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
