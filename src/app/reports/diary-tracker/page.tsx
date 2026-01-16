'use client';

import React from 'react';
// import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
// import { collection } from 'firebase/firestore';
import type { DailyDiary } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default function DiaryTrackerPage() {
  // const firestore = useFirestore();
  // const diariesQuery = useMemoFirebase(() => collection(firestore, 'daily_diaries'), [firestore]);
  // const { data: diaries, isLoading } = useCollection<DailyDiary>(diariesQuery);

  // Temporarily hardcode data to prevent data-fetching crash
  const diaries: DailyDiary[] = [];
  const isLoading = false;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Daily Diary Tracker</h1>
            <p className="text-muted-foreground">
                View and manage all submitted daily diaries.
            </p>
        </div>
        <Link href="/reports/contractors-daily-diary" passHref>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Diary
            </Button>
        </Link>
      </header>
      <Card>
        <CardHeader>
            <CardTitle>Submitted Diaries</CardTitle>
            <CardDescription>A log of all contractor daily diaries.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Document ID</TableHead>
                        <TableHead>Contract Title</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                <div className="flex justify-center items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading diaries...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : diaries && diaries.length > 0 ? (
                        diaries.map(diary => (
                            <TableRow key={diary.id}>
                                <TableCell className="font-mono text-xs">{diary.id}</TableCell>
                                <TableCell>{diary.contractTitle}</TableCell>
                                <TableCell>{diary.date}</TableCell>
                                <TableCell>{diary.area}</TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/reports/contractors-daily-diary/${diary.id}`} passHref>
                                        <Button variant="ghost" size="icon">
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                No diaries found.
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
