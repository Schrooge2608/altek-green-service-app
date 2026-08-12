'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { ScheduledTask, User as AppUser, Equipment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, UserCheck, Eye, Pencil, MapPin, Pickaxe, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function UpcomingSchedulesPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { user } = useUser();

    const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: currentUserData } = useDoc<AppUser>(userRoleRef);

    const schedulesQuery = useMemoFirebase(
        () => query(collection(firestore, 'upcoming_schedules'), orderBy('scheduledFor', 'asc')),
        [firestore]
    );
    const { data: schedules, isLoading: schedulesLoading } = useCollection<ScheduledTask>(schedulesQuery);

    const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
    const { data: allEquipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

    // Filter out 'Approved' tasks and join with equipment location
    const activeSchedules = useMemo(() => {
        if (!schedules) return [];
        const eqMap = new Map(allEquipment?.map(e => [e.id, e]) || []);

        return schedules
            .filter(s => s.status !== 'Approved')
            .map(s => {
                const eq = eqMap.get(s.equipmentId);
                return {
                    ...s,
                    displayArea: s.area || (eq ? `${eq.plant} > ${eq.division} > ${eq.location}` : 'Unknown Location'),
                    plant: eq?.plant || 'Unknown'
                };
            });
    }, [schedules, allEquipment]);
    
    const miningSchedules = useMemo(() => activeSchedules.filter(s => s.plant === 'Mining'), [activeSchedules]);
    const smelterSchedules = useMemo(() => activeSchedules.filter(s => s.plant === 'Smelter'), [activeSchedules]);

    const isLoading = schedulesLoading || equipmentLoading;

    const getStatusStyles = (status: string) => {
        const normalized = status.toLowerCase();
        
        if (normalized === 'pending' || normalized === 'in progress') {
          return 'bg-amber-100 text-amber-800 border-amber-200';
        }
        if (normalized === 'completed') {
            return 'bg-blue-100 text-blue-800 border-blue-200';
        }
        if (normalized === 'approved') {
          return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        }
        return 'bg-slate-100 text-slate-600 border-slate-200';
      };

    const ScheduleTable = ({ tasks }: { tasks: any[] }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Equipment & Location</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Scheduled For</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tasks.map(task => {
                    const status = task.status || 'Pending';
                    const isAssignee = user?.uid === task.assignedToId;

                    return (
                        <TableRow key={task.id}>
                            <TableCell className="font-medium">
                                <div className="flex flex-col gap-1 py-1">
                                    <Link href={`/equipment/${task.equipmentId}`} className="hover:underline text-primary font-bold">
                                        {task.equipmentName}
                                    </Link>
                                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {task.displayArea}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>{task.task}</TableCell>
                            <TableCell>{task.scheduledFor}</TableCell>
                            <TableCell>{task.assignedToName}</TableCell>
                            <TableCell>
                                <Badge className={cn("capitalize", getStatusStyles(status))}>{status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                    {(() => {
                                    if (task.status === 'Approved') {
                                        return (
                                            <Button variant="ghost" size="sm" onClick={() => router.push(`/maintenance/resolve/${task.id}`)}><Eye className="mr-2 h-4 w-4" />View</Button>
                                        );
                                    }
                                    if (task.status === 'Completed') {
                                        return (
                                            <Button variant="outline" size="sm" className="border-amber-500 text-amber-600" onClick={() => router.push(`/maintenance/resolve/${task.id}`)}>
                                                <UserCheck className="mr-2 h-4 w-4" /> For Approval
                                            </Button>
                                        );
                                    }
                                    if (isAssignee) {
                                        return (
                                            <Button variant="default" size="sm" onClick={() => router.push(`/maintenance/resolve/${task.id}`)}>
                                                <Pencil className="mr-2 h-4 w-4" /> Action
                                            </Button>
                                        );
                                    }
                                    return (
                                        <Button variant="secondary" size="sm" onClick={() => router.push(`/maintenance/resolve/${task.id}`)}>
                                            <Eye className="mr-2 h-4 w-4" /> View Only
                                        </Button>
                                    );
                                })()}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Upcoming Schedules</h1>
                <p className="text-muted-foreground">
                    Maintenance tasks scheduled for the coming week, divided by plant area.
                </p>
            </header>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="ml-2">Loading scheduled tasks...</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {/* MINING SECTION */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <Pickaxe className="h-5 w-5 text-emerald-600" />
                            <h2 className="text-xl font-bold text-slate-800">Mining Operations</h2>
                        </div>
                        <Card className="border-emerald-100 shadow-sm">
                            <CardContent className="p-0">
                                {miningSchedules.length > 0 ? (
                                    <ScheduleTable tasks={miningSchedules} />
                                ) : (
                                    <div className="p-12 text-center text-slate-400">
                                        <p className="italic">No upcoming mining schedules found.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* SMELTER SECTION */}
                    <div className="space-y-4 pb-12">
                        <div className="flex items-center gap-2 px-1">
                            <Building className="h-5 w-5 text-blue-600" />
                            <h2 className="text-xl font-bold text-slate-800">Smelter Operations</h2>
                        </div>
                        <Card className="border-blue-100 shadow-sm">
                            <CardContent className="p-0">
                                {smelterSchedules.length > 0 ? (
                                    <ScheduleTable tasks={smelterSchedules} />
                                ) : (
                                    <div className="p-12 text-center text-slate-400">
                                        <p className="italic">No upcoming smelter schedules found.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
