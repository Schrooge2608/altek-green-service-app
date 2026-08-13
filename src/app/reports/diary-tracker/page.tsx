'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { DailyDiary, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, PlusCircle, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
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

  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const toggleMonth = (monthStr: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthStr]: !prev[monthStr]
    }));
  };

  const groupedDiaries = useMemo(() => {
      if (!diaries || !users) return [];
      const userNameMap = new Map(users.map(u => [u.id, u.name]));
      
      const sorted = [...diaries].sort((a, b) => {
          const tA = new Date(a.date as string).getTime();
          const tB = new Date(b.date as string).getTime();
          return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });

      const groups: { monthStr: string, items: any[] }[] = [];
      sorted.forEach(diary => {
          let displayDate = 'N/A';
          let monthStr = 'Unknown';
          if (diary.date) {
              try {
                  const dateObj = (diary.date as any).seconds ? new Date((diary.date as any).seconds * 1000) : new Date(diary.date as any);
                  if (!isNaN(dateObj.getTime())) {
                      displayDate = dateObj.toISOString().split('T')[0];
                      monthStr = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  }
              } catch (e) {
                  displayDate = String(diary.date);
              }
          }
          
          const enhancedDiary = {
            ...diary,
            creatorName: userNameMap.get(diary.userId) || 'Unknown User',
            displayDate,
          };

          let group = groups.find(g => g.monthStr === monthStr);
          if (!group) {
            group = { monthStr, items: [] };
            groups.push(group);
          }
          group.items.push(enhancedDiary);
      });
      return groups;
  }, [diaries, users]);

  useEffect(() => {
    if (groupedDiaries.length > 0 && Object.keys(expandedMonths).length === 0) {
      setExpandedMonths({ [groupedDiaries[0].monthStr]: true });
    }
  }, [groupedDiaries, expandedMonths]);

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
                        <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                    ) : groupedDiaries.length > 0 ? (
                        groupedDiaries.map(group => {
                          const isExpanded = expandedMonths[group.monthStr] ?? false;
                          return (
                          <React.Fragment key={group.monthStr}>
                            <TableRow 
                              className="bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                              onClick={() => toggleMonth(group.monthStr)}
                            >
                              <TableCell colSpan={7} className="font-bold text-slate-800 py-2 pl-6 shadow-[inset_0_1px_0_rgba(0,0,0,0.05),inset_0_-1px_0_rgba(0,0,0,0.05)]">
                                <div className="flex items-center gap-2 select-none">
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  {group.monthStr}
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && group.items.map(diary => {
                                const statusText = diary.isFinalised ? 'Approved' : diary.isSignedOff ? 'Completed' : 'In Progress';
                                const isInProgress = statusText === 'In Progress';
                                return (
                                <TableRow key={diary.id} className="hover:bg-slate-50">
                                    <TableCell className="font-mono font-bold text-primary pl-6">{diary.diaryReference || diary.id}</TableCell>
                                    <TableCell>{diary.creatorName}</TableCell>
                                    <TableCell>{diary.contractTitle}</TableCell>
                                    <TableCell className="font-mono text-xs">{diary.displayDate}</TableCell>
                                    <TableCell>{diary.area}</TableCell>
                                    <TableCell><Badge className={getStatusStyles(statusText)}>{statusText}</Badge></TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Link href={`/reports/contractors-daily-diary?id=${diary.id}`} passHref>
                                            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5">
                                                {isInProgress ? <Pencil className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                                                {isInProgress ? "Edit" : "View"}
                                            </Button>
                                        </Link>
                                        {canDelete && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                     <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 ml-2" disabled={!diary.id}><Trash2 className="h-4 w-4" /></Button>
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
                            )})}
                          </React.Fragment>
                          );
                        })
                    ) : (
                        <TableRow><TableCell colSpan={7} className="h-24 text-center">No submitted V2 diaries found.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
