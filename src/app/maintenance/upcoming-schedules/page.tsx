
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { ScheduledTask } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, Edit, Eye, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function UpcomingSchedulesPage() {
    const firestore = useFirestore();

    const schedulesQuery = useMemoFirebase(
        () => query(collection(firestore, 'upcoming_schedules'), orderBy('scheduledFor', 'asc')),
        [firestore]
    );
    
    const { data: schedules, isLoading } = useCollection<ScheduledTask>(schedulesQuery);

    const statusVariantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        'Pending': 'secondary',
        'In Progress': 'default',
        'Completed': 'outline',
        'Approved': 'default',
        'Cancelled': 'destructive',
    };
    
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

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Upcoming Schedules</h1>
                <p className="text-muted-foreground">
                    A list of tasks scheduled by technicians for the coming week.
                </p>
            </header>
            <Card>
                <CardHeader>
                    <CardTitle>Scheduled Tasks</CardTitle>
                    <CardDescription>
                        These are the maintenance tasks that have been added to the upcoming work schedule.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Equipment</TableHead>
                                <TableHead>Task</TableHead>
                                <TableHead>Scheduled For</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <div className="flex justify-center items-center">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading scheduled tasks...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : schedules && schedules.length > 0 ? (
                                schedules.map(task => {
                                    const status = task.status || 'Pending';
                                    return (
                                        <TableRow key={task.id}>
                                            <TableCell className="font-medium">
                                                <Link href={`/maintenance/resolve/${task.id}`} className="hover:underline text-primary">
                                                    {task.equipmentName}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{task.task}</TableCell>
                                            <TableCell>{task.scheduledFor}</TableCell>
                                            <TableCell>{task.assignedToName}</TableCell>
                                            <TableCell>
                                                <Badge className={cn("capitalize", getStatusStyles(status))}>{status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                 <Link href={`/maintenance/resolve/${task.id}`} passHref>
                                                    {status === 'Approved' ? (
                                                        <Button variant="ghost" size="sm"><Eye className="mr-2 h-4 w-4" />View</Button>
                                                    ) : status === 'Completed' ? (
                                                         <Button variant="outline" size="sm" className="text-amber-600 border-amber-400 hover:bg-amber-50 hover:text-amber-700"><UserCheck className="mr-2 h-4 w-4" />For Approval</Button>
                                                    ) : (
                                                        <Button variant="default" size="sm"><Edit className="mr-2 h-4 w-4" />Action</Button>
                                                    )}
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No tasks have been scheduled yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
