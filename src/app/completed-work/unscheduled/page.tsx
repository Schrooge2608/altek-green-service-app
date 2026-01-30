'use client';

import React, { useMemo } from 'react';
import type { DailyDiary, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { format } from 'date-fns';

export default function CompletedUnscheduledWorkPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const diariesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'daily_diaries'), where('isFinalised', '==', true));
  }, [firestore, user]);
  const { data: diaries, isLoading: diariesLoading } = useCollection<DailyDiary>(diariesQuery);
  
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
  
  const diariesWithCreator = useMemo(() => {
      if (!diaries || !users) return [];

      const userNameMap = new Map(users.map(u => [u.id, u.name]));

      return diaries.map(diary => {
        let equipmentName = 'General';
        const workWithEquipment = diary.works?.find(w => w.scope?.startsWith('Unscheduled work on: '));
        if (workWithEquipment?.scope) {
          equipmentName = workWithEquipment.scope.replace('Unscheduled work on: ', '');
        }

        return {
          ...diary,
          creatorName: userNameMap.get(diary.userId) || 'Unknown User',
          equipmentName,
          issue: diary.works?.[0]?.scope || 'N/A'
        };
      }).sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());
  }, [diaries, users]);

  const isLoading = diariesLoading || usersLoading;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Completed Unscheduled Work</h1>
            <p className="text-muted-foreground">
                An archive of all finalized and completed daily diaries for unscheduled work.
            </p>
        </div>
      </header>
      <Card>
        <CardHeader>
            <CardTitle>Archived Diaries</CardTitle>
            <CardDescription>A log of all finalized daily diaries.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Contractor</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Issue / Scope</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                <div className="flex justify-center items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading archived diaries...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : diariesWithCreator && diariesWithCreator.length > 0 ? (
                        diariesWithCreator.map(diary => (
                            <TableRow key={diary.id}>
                                <TableCell>{typeof diary.date === 'string' ? diary.date : format(new Date(diary.date), 'yyyy-MM-dd')}</TableCell>
                                <TableCell>{diary.creatorName}</TableCell>
                                <TableCell>{diary.equipmentName}</TableCell>
                                <TableCell>{diary.issue}</TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/reports/contractors-daily-diary/view?id=${diary.id}`} passHref>
                                        <Button variant="ghost" size="icon" title="View Report">
                                            <FileText className="h-4 w-4" />
                                            <span className="sr-only">View Diary</span>
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                                No archived diaries found.
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
