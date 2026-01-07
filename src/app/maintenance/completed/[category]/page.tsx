'use client';

import { useParams, notFound } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { CompletedSchedule } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import React, { useMemo } from 'react';

const validCategories: Record<string, string> = {
  vsds: 'VSDs',
  protection: 'Protection',
  motors: 'Motors',
  pumps: 'Pumps',
};

const frequencies: CompletedSchedule['frequency'][] = ['Weekly', 'Monthly', '3-Monthly', '6-Monthly', 'Yearly'];

function CompletedSchedulesTable({ schedules, isLoading, frequency }: { schedules: CompletedSchedule[] | null, isLoading: boolean, frequency: string }) {
    if (isLoading) {
        return <div className="text-center py-10">Loading schedules...</div>
    }
    if (!schedules || schedules.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">No {frequency.toLowerCase()} schedules found.</div>
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Completion Date</TableHead>
                    <TableHead>Inspected By</TableHead>
                    <TableHead className="text-right">Document</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {schedules.map(schedule => (
                    <TableRow key={schedule.id}>
                        <TableCell>{schedule.equipmentName}</TableCell>
                        <TableCell>{schedule.area}</TableCell>
                        <TableCell>{schedule.completionDate}</TableCell>
                        <TableCell>{schedule.inspectedBy}</TableCell>
                        <TableCell className="text-right">
                            <Link href={`/completed-docs/${schedule.id}`} passHref>
                                <Button variant="ghost" size="icon">
                                    <FileText className="h-4 w-4" />
                                </Button>
                            </Link>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}


export default function CompletedSchedulesByCategoryPage() {
  const params = useParams();
  const categorySlug = Array.isArray(params.category) ? params.category[0] : params.category;
  const category = validCategories[categorySlug];

  const firestore = useFirestore();

  const schedulesQuery = useMemoFirebase(() => {
    if (!category) return null;
    return query(collection(firestore, 'completed_schedules'), where('maintenanceType', '==', category));
  }, [firestore, category]);

  const { data: schedules, isLoading } = useCollection<CompletedSchedule>(schedulesQuery);

  const schedulesByFrequency = useMemo(() => {
    if (!schedules) return {} as Record<string, CompletedSchedule[]>;
    return schedules.reduce((acc, schedule) => {
      const freq = schedule.frequency;
      if (!acc[freq]) {
        acc[freq] = [];
      }
      acc[freq].push(schedule);
      return acc;
    }, {} as Record<string, CompletedSchedule[]>);
  }, [schedules]);

  if (!category) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Completed Schedules: {category}</h1>
        <p className="text-muted-foreground">
          A history of all completed maintenance documents for {category}.
        </p>
      </header>

      <div className="space-y-8">
        {frequencies.map(freq => (
            <Card key={freq}>
                <CardHeader>
                    <CardTitle>{freq} Schedules</CardTitle>
                </CardHeader>
                <CardContent>
                    <CompletedSchedulesTable
                        schedules={schedulesByFrequency[freq] || []}
                        isLoading={isLoading}
                        frequency={freq}
                    />
                </CardContent>
            </Card>
        ))}
      </div>
    </div>
  );
}
