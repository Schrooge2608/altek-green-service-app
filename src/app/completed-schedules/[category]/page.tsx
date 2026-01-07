'use client';

import React, { useMemo } from 'react';
import { notFound, useParams } from 'next/navigation';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { CompletedSchedule } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, Wrench, Shield, CircuitBoard, Droplets } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const validCategories: Record<string, { name: string; icon: React.ElementType }> = {
    'vsds': { name: 'VSDs', icon: CircuitBoard },
    'protection': { name: 'Protection', icon: Shield },
    'motors': { name: 'Motors', icon: Wrench },
    'pumps': { name: 'Pumps', icon: Droplets },
};

const frequencies: CompletedSchedule['frequency'][] = ['Weekly', 'Monthly', '3-Monthly', '6-Monthly', 'Yearly'];

export default function CompletedCategoryPage() {
    const params = useParams();
    const categorySlug = Array.isArray(params.category) ? params.category[0] : params.category;

    const categoryInfo = useMemo(() => {
        if (!categorySlug || !validCategories[categorySlug]) {
            notFound();
        }
        return validCategories[categorySlug];
    }, [categorySlug]);

    const firestore = useFirestore();

    const schedulesQuery = useMemoFirebase(() => {
        if (!categorySlug) return null;
        return query(
            collection(firestore, 'completed_schedules'), 
            where('maintenanceType', '==', categorySlug)
        );
    }, [firestore, categorySlug]);

    const { data: schedules, isLoading } = useCollection<CompletedSchedule>(schedulesQuery);

    const schedulesByFrequency = useMemo(() => {
        if (!schedules) return {};
        return schedules.reduce((acc, schedule) => {
            const frequency = schedule.frequency;
            if (!acc[frequency]) {
                acc[frequency] = [];
            }
            acc[frequency].push(schedule);
            return acc;
        }, {} as Record<string, CompletedSchedule[]>);
    }, [schedules]);

    const TableSkeleton = () => (
         <div className="space-y-2 pt-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
        </div>
    );

    if (!categoryInfo) {
        return null; // notFound() is called in useMemo
    }

    const CategoryIcon = categoryInfo.icon;

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <CategoryIcon className="h-8 w-8 text-primary" />
                    Completed Schedules: {categoryInfo.name}
                </h1>
                <p className="text-muted-foreground">
                    A log of all completed service documents for {categoryInfo.name}.
                </p>
            </header>

            <Accordion type="multiple" className="w-full space-y-4" defaultValue={frequencies.map(f => `item-${f}`)}>
                {frequencies.map(frequency => (
                    <AccordionItem value={`item-${frequency}`} key={frequency}>
                        <AccordionTrigger className="text-xl font-semibold px-4 py-3 bg-card rounded-lg border">
                           {frequency} Schedules
                           {schedulesByFrequency[frequency] && ` (${schedulesByFrequency[frequency].length})`}
                        </AccordionTrigger>
                        <AccordionContent>
                             <Card className="rounded-t-none border-t-0">
                                <CardContent className="pt-0">
                                    {isLoading ? <TableSkeleton /> : (
                                        schedulesByFrequency[frequency] && schedulesByFrequency[frequency].length > 0 ? (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Equipment</TableHead>
                                                        <TableHead>Completion Date</TableHead>
                                                        <TableHead className="text-right">Document</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {schedulesByFrequency[frequency].map(schedule => (
                                                        <TableRow key={schedule.id}>
                                                            <TableCell className="font-medium">{schedule.equipmentName}</TableCell>
                                                            <TableCell>{schedule.completionDate}</TableCell>
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
                                            <p className="text-sm text-muted-foreground text-center py-8">
                                                No completed {frequency.toLowerCase()} schedules found for this category.
                                            </p>
                                        )
                                    )}
                                </CardContent>
                            </Card>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}
