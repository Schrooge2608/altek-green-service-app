'use client';

import React, { useMemo } from 'react';
import type { DailyDiary, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
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
import { Badge } from '@/components/ui/badge';

// Helper to get colors based on status
const getStatusStyles = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'in progress') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (normalized === 'completed' || normalized === 'approved') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

export default function DiaryTrackerV2Page() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: currentUserData, isLoading: currentUserLoading } = useDoc<User>(userRoleRef);

  const diariesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'daily_diaries'), where('version', '==', 'v2'));
  }, [firestore, user]);
  
  const { data: diaries, isLoading: diariesLoading } = useCollection<DailyDiary>(diariesQuery);
  
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
  
  const canDelete = useMemo(() => {
    if (!currentUserData) return false;
    return ['Admin', 'Superadmin'].includes(currentUserData.role);
  }, [currentUserData]);

  const diariesWithContext = useMemo(() => {
      if (!diaries || !users) return [];
      const userNameMap = new Map(users.map(u => [u.id, u.name]));
      return diaries.map(diary => {
        let displayDate = 'N/A';
        if (diary.date) {
            try {
                const dateObj = (diary.date as any).seconds ? new Date((diary.date as any).seconds * 1000) : new Date(diary.date as any);
                if (!isNaN(dateObj.getTime())) displayDate = dateObj.toISOString().split('T')[0];
            } catch (e) {
                displayDate = String(diary.date);
            }
        }
        return {
          ...diary,
          creatorName: userNameMap.get(diary.userId) || 'Unknown User',
          displayDate,
        };
      }).sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());
  }, [diaries, users]);

  const handleDeleteDiary = (diaryToDelete: DailyDiary) => {
    if (!diaryToDelete.id) return;
    deleteDocumentNonBlocking(doc(firestore, 'daily_diaries', diaryToDelete.id));
    toast({ title: 'Diary Deleted', description: `The daily diary ${diaryToDelete.id} has been removed.` });
  }

  const isLoading = diariesLoading || usersLoading || currentUserLoading;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Daily Diary Tracker</h1>
            <p className="text-muted-foreground">View and manage all submitted daily diaries.</p>
        </div>
        <Link href="/reports/contractors-daily-diary" passHref>
            <Button><PlusCircle className="mr-2 h-4 w-4" /> New Diary</Button>
        </Link>
      </header>
      <Card>
        <CardHeader>
            <CardTitle>Submitted V2 Diaries</CardTitle>
            <CardDescription>A log of all V2 daily diaries submitted by all users.</CardDescription>
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
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                    ) : diariesWithContext && diariesWithContext.length > 0 ? (
                        diariesWithContext.map(diary => {
                            const statusText = diary.isFinalised ? 'Approved' : diary.isSignedOff ? 'Completed' : 'In Progress';
                            const isInProgress = statusText === 'In Progress';
                            return (
                            <TableRow key={diary.id}>
                                <TableCell className="font-mono">{diary.id}</TableCell>
                                <TableCell>{diary.creatorName}</TableCell>
                                <TableCell>{diary.contractTitle}</TableCell>
                                <TableCell>{diary.displayDate}</TableCell>
                                <TableCell>{diary.area}</TableCell>
                                <TableCell><Badge className={getStatusStyles(statusText)}>{statusText}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/reports/contractors-daily-diary?id=${diary.id}`} passHref>
                                        <Button variant="ghost" size="icon" title={isInProgress ? "Edit Diary" : "View Diary"}>
                                            {isInProgress ? <Pencil className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                            <span className="sr-only">{isInProgress ? "Edit" : "View"}</span>
                                        </Button>
                                    </Link>
                                    {canDelete && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                 <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" disabled={!diary.id}><Trash2 className="h-4 w-4" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete {diary.id}.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => handleDeleteDiary(diary)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </TableCell>
                            </TableRow>
                        )})
                    ) : (
                        <TableRow><TableCell colSpan={8} className="h-24 text-center">No submitted V2 diaries found.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
