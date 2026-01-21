
'use client';

import React, { useMemo } from 'react';
import type { DailyDiary, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
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

export default function DiaryTrackerPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: currentUserData, isLoading: currentUserLoading } = useDoc<User>(userRoleRef);

  const diariesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'daily_diaries');
  }, [firestore, user]);
  const { data: diaries, isLoading: diariesLoading } = useCollection<DailyDiary>(diariesQuery);
  
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
  
  const canDelete = useMemo(() => {
    if (!currentUserData) return false;
    return ['Admin', 'Superadmin'].includes(currentUserData.role);
  }, [currentUserData]);

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
        };
      });
  }, [diaries, users]);

  const handleDeleteDiary = (diaryToDelete: DailyDiary) => {
    if (!diaryToDelete.id) {
        toast({
            variant: "destructive",
            title: 'Error',
            description: `Diary ID is missing, cannot delete.`,
        });
        return;
    }
    const diaryRef = doc(firestore, 'daily_diaries', diaryToDelete.id);
    deleteDocumentNonBlocking(diaryRef);
    toast({
        title: 'Diary Deleted',
        description: `The daily diary ${diaryToDelete.id} has been removed from the database.`,
    });
  }

  const isLoading = diariesLoading || usersLoading || currentUserLoading;

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
            <CardDescription>A log of all daily diaries submitted by all users.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Document ID</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Contract Title</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                <div className="flex justify-center items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading diaries...
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : diariesWithCreator && diariesWithCreator.length > 0 ? (
                        diariesWithCreator.map(diary => (
                            <TableRow key={diary.id}>
                                <TableCell className="font-mono">{diary.id}</TableCell>
                                <TableCell>{diary.creatorName}</TableCell>
                                <TableCell>{diary.contractTitle}</TableCell>
                                <TableCell>{diary.equipmentName}</TableCell>
                                <TableCell>{diary.date}</TableCell>
                                <TableCell>{diary.area}</TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/reports/view-diary/${diary.id}`} passHref>
                                        <Button variant="ghost" size="icon">
                                            <FileText className="h-4 w-4" />
                                            <span className="sr-only">View Diary</span>
                                        </Button>
                                    </Link>
                                     {user?.uid === diary.userId && (
                                        <Link href={`/reports/contractors-daily-diary?id=${diary.id}`} passHref>
                                            <Button variant="ghost" size="icon">
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Edit Diary</span>
                                            </Button>
                                        </Link>
                                    )}
                                    {canDelete && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                 <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" disabled={!diary.id}>
                                                    <Trash2 className="h-4 w-4" />
                                                    <span className="sr-only">Delete Diary</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action will permanently delete the diary record <strong>{diary.id}</strong>. 
                                                        This cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                                        onClick={() => handleDeleteDiary(diary)}
                                                    >
                                                        Yes, delete diary
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
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
