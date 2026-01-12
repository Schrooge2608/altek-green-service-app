
'use client';

import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, CheckCircle, CalendarIcon } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import type { Breakdown, Equipment, VSD } from '@/lib/types';
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
import { format } from 'date-fns';

function ResolveBreakdownDialog({ breakdown, onResolve, children }: { breakdown: Breakdown, onResolve: (b: Breakdown, resolutionDetails: {normal: number, overtime: number, timeBackInService: Date}) => void, children: React.ReactNode }) {
  const [normalHours, setNormalHours] = React.useState(0);
  const [overtimeHours, setOvertimeHours] = React.useState(0);
  const [timeBackInService, setTimeBackInService] = React.useState<Date | undefined>();

  const handleResolveClick = () => {
    if (!timeBackInService) {
        // Ideally, show a toast or message to the user
        console.error("Time back in service is required.");
        return;
    }
    onResolve(breakdown, { normal: normalHours, overtime: overtimeHours, timeBackInService });
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
          <AlertDialogAction onClick={handleResolveClick} disabled={!timeBackInService}>
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
  const breakdownsQuery = useMemoFirebase(() => collection(firestore, 'breakdown_reports'), [firestore]);
  const { data: breakdowns, isLoading } = useCollection<Breakdown>(breakdownsQuery);

  const handleResolve = async (breakdown: Breakdown, resolutionDetails: {normal: number, overtime: number, timeBackInService: Date}) => {
    const breakdownRef = doc(firestore, 'breakdown_reports', breakdown.id);
    const equipmentRef = doc(firestore, 'equipment', breakdown.equipmentId);

    // Calculate downtime
    let downtimeHours = 0;
    if (breakdown.timeReported && resolutionDetails.timeBackInService) {
        const downtimeMillis = resolutionDetails.timeBackInService.getTime() - new Date(breakdown.timeReported).getTime();
        downtimeHours = downtimeMillis / (1000 * 60 * 60);
    }
    
    // Update equipment's total downtime and uptime percentage
    try {
        const eqDoc = await getDoc(equipmentRef);
        if (eqDoc.exists()) {
            const eqData = eqDoc.data() as Equipment;
            const vsdRef = doc(firestore, 'vsds', eqData.vsdId);
            const vsdDoc = await getDoc(vsdRef);
            
            if (vsdDoc.exists()) {
                const vsdData = vsdDoc.data() as VSD;
                const currentDowntime = eqData.totalDowntimeHours || 0;
                const newTotalDowntime = currentDowntime + downtimeHours;

                // Calculate new uptime percentage
                const installationDate = new Date(vsdData.installationDate);
                const now = new Date();
                const totalHours = (now.getTime() - installationDate.getTime()) / (1000 * 60 * 60);
                let newUptimePercentage = 100;
                if (totalHours > 0) {
                    const uptimeHours = totalHours - newTotalDowntime;
                    newUptimePercentage = Math.max(0, (uptimeHours / totalHours) * 100);
                }

                updateDocumentNonBlocking(equipmentRef, { 
                    totalDowntimeHours: newTotalDowntime,
                    uptime: newUptimePercentage,
                });
            }
        }
    } catch (e) {
        console.error("Failed to update equipment downtime: ", e);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "Could not update the equipment's downtime. The breakdown status was not updated.",
        });
        return; // Stop if we can't update the equipment
    }

    // Update breakdown report
    updateDocumentNonBlocking(breakdownRef, { 
        resolved: true,
        normalHours: resolutionDetails.normal,
        overtimeHours: resolutionDetails.overtime,
        timeBackInService: resolutionDetails.timeBackInService.toISOString(),
    });

    toast({
        title: "Breakdown Resolved",
        description: `The issue for ${breakdown.equipmentName} has been marked as resolved.`,
    });
  }
  
  const formatDate = (dateString?: string) => {
      if (!dateString) return 'N/A';
      try {
          return format(new Date(dateString), 'yyyy-MM-dd HH:mm');
      } catch (e) {
          return dateString; // fallback to original string if format fails
      }
  }

  const totalHoursSum = useMemo(() => {
    if (!breakdowns) return 0;
    return breakdowns.reduce((acc, b) => acc + (b.normalHours ?? 0) + (b.overtimeHours ?? 0), 0);
  }, [breakdowns]);


  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Breakdown Log</h1>
          <p className="text-muted-foreground">
            History of all reported equipment breakdowns.
          </p>
        </div>
        <Link href="/breakdowns/new" passHref>
          <Button variant="destructive">
              <PlusCircle className="mr-2 h-4 w-4" />
              Report New Breakdown
          </Button>
        </Link>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time Reported</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time Back in Service</TableHead>
                <TableHead className="text-right">Normal Hours</TableHead>
                <TableHead className="text-right">Overtime Hours</TableHead>
                <TableHead className="text-right">Total Hours</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center h-24">Loading breakdowns...</TableCell>
                </TableRow>
              ) : breakdowns && breakdowns.length > 0 ? (
                breakdowns.map((b) => {
                  const totalHours = (b.normalHours ?? 0) + (b.overtimeHours ?? 0);
                  return (
                    <TableRow key={b.id}>
                      <TableCell>{formatDate(b.timeReported)}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/equipment/${b.equipmentId}`} className="hover:underline text-primary">
                            {b.equipmentName}
                        </Link>
                      </TableCell>
                      <TableCell>{b.description}</TableCell>
                      <TableCell>
                        <Badge variant={b.resolved ? 'default' : 'destructive'}>
                          {b.resolved ? 'Resolved' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>{b.resolved ? formatDate(b.timeBackInService) : 'N/A'}</TableCell>
                      <TableCell className="text-right">{b.resolved ? b.normalHours ?? 0 : 'N/A'}</TableCell>
                      <TableCell className="text-right">{b.resolved ? b.overtimeHours ?? 0 : 'N/A'}</TableCell>
                      <TableCell className="text-right">{b.resolved ? totalHours : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        {!b.resolved && (
                          <ResolveBreakdownDialog breakdown={b} onResolve={handleResolve}>
                              <Button variant="ghost" size="sm">
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Resolved
                              </Button>
                          </ResolveBreakdownDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center h-24">No breakdowns found.</TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={7} className="font-semibold text-right">Total Hours Spent</TableCell>
                    <TableCell className="text-right font-bold">{totalHoursSum}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
