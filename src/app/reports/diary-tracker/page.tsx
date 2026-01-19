
'use client';

import React, { useMemo } from 'react';
import type { DailyDiary, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function DiaryTrackerPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const diariesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'daily_diaries');
  }, [firestore, user]);
  const { data: diaries, isLoading: diariesLoading } = useCollection<DailyDiary>(diariesQuery);
  
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const technicianRoles = [
      'Technician', 'Technician (Beta)',
      'Junior Technician', 'Junior Technician (Beta)',
      'Technologist', 'Technologist (Beta)',
      'Power systems engineer', 'Power systems engineer (Beta)',
      'HVAC product specialist', 'HVAC product specialist (Beta)'
  ];

  const filteredDiaries = useMemo(() => {
      if (!diaries || !users) return [];

      const userRoleMap = new Map(users.map(u => [u.id, u.role]));
      const userNameMap = new Map(users.map(u => [u.id, u.name]));

      return diaries
          .filter(diary => {
              const userRole = userRoleMap.get(diary.userId);
              return userRole && technicianRoles.includes(userRole);
          })
          .map(diary => ({
              ...diary,
              creatorName: userNameMap.get(diary.userId) || 'Unknown User'
          }));
  }, [diaries, users]);

  const isLoading = diariesLoading || usersLoading;

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
            <CardDescription>A log of all daily diaries submitted by technicians and technologists.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Document ID</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Contract Title</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                <div className="flex justify-center items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading diaries...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : filteredDiaries && filteredDiaries.length > 0 ? (
                        filteredDiaries.map(diary => (
                            <TableRow key={diary.id}>
                                <TableCell className="font-mono">{diary.id}</TableCell>
                                <TableCell>{diary.creatorName}</TableCell>
                                <TableCell>{diary.contractTitle}</TableCell>
                                <TableCell>{diary.date}</TableCell>
                                <TableCell>{diary.area}</TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/reports/contractors-daily-diary/${diary.id}`} passHref>
                                        <Button variant="ghost" size="icon">
                                            <FileText className="h-4 w-4" />
                                            <span className="sr-only">View Diary</span>
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                No submitted diaries found.
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
