'use client';

import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { CompletedSchedule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const categories = [
    { name: 'VSDs', slug: 'vsds' },
    { name: 'Protection', slug: 'protection' },
    { name: 'Motors', slug: 'motors' },
    { name: 'Pumps', slug: 'pumps' },
];

export default function CompletedSchedulesPage() {
    const firestore = useFirestore();
    const schedulesQuery = useMemoFirebase(() => collection(firestore, 'completed_schedules'), [firestore]);
    const { data: schedules, isLoading } = useCollection<CompletedSchedule>(schedulesQuery);

    const schedulesByCategory = useMemo(() => {
        if (!schedules) return {};
        return schedules.reduce((acc, schedule) => {
            const category = schedule.maintenanceType.toLowerCase();
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(schedule);
            return acc;
        }, {} as Record<string, CompletedSchedule[]>);
    }, [schedules]);

    const TableSkeleton = () => (
         <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
        </div>
    );

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Completed Maintenance Schedules</h1>
                <p className="text-muted-foreground">
                    A log of all completed service documents.
                </p>
            </header>

            <div className="space-y-8">
                {categories.map(category => (
                    <Card key={category.slug}>
                        <CardHeader>
                            <CardTitle>{category.name}</CardTitle>
                            <CardDescription>All completed schedules for {category.name}.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <TableSkeleton /> : (
                                schedulesByCategory[category.slug] && schedulesByCategory[category.slug].length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Equipment</TableHead>
                                                <TableHead>Completion Date</TableHead>
                                                <TableHead>Frequency</TableHead>
                                                <TableHead className="text-right">Document</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {schedulesByCategory[category.slug].map(schedule => (
                                                <TableRow key={schedule.id}>
                                                    <TableCell className="font-medium">{schedule.equipmentName}</TableCell>
                                                    <TableCell>{schedule.completionDate}</TableCell>
                                                    <TableCell>{schedule.frequency}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Link href={`/completed-schedules/${schedule.id}`} passHref>
                                                            <Button variant="outline" size="sm">
                                                                <FileText className="mr-2 h-4 w-4" />
                                                                View Document
                                                            </Button>
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No completed schedules found for this category.
                                    </p>
                                )
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
