'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { ScheduledTask } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, Edit } from 'lucide-react';
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

    const statusVariantMap = {
        'Pending': 'secondary',
        'In Progress': 'default',
        'Completed': 'outline',
        'Cancelled': 'destructive',
    } as const;

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
                                                <Badge variant={statusVariantMap[task.status]}>{task.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link href={`/maintenance/resolve/${task.id}`} passHref>
                                                    <Button variant="ghost" size="sm">
                                                        <CheckCircle className="mr-2 h-4 w-4" />
                                                        Resolve
                                                    </Button>
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
