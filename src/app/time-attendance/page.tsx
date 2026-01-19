
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useDoc, useFirestore, useUser, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import type { DailyAttendance, AttendanceEntry, User as AppUser } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import React, { useMemo } from 'react';

export default function TimeAttendancePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const attendanceRef = useMemoFirebase(() => doc(firestore, 'attendance', today), [firestore, today]);
  const { data: attendanceDoc, isLoading: attendanceLoading } = useDoc<DailyAttendance>(attendanceRef);
  
  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<AppUser>(userRef);

  const isLoading = isUserLoading || attendanceLoading;

  const currentUserEntry = useMemo(() => {
    if (!user || !attendanceDoc?.attendees) return null;
    return attendanceDoc.attendees.find(entry => entry.userId === user.uid);
  }, [user, attendanceDoc]);

  const handleSignIn = () => {
    if (!user || !userData) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to sign in.' });
      return;
    }

    const newEntry: AttendanceEntry = {
      userId: user.uid,
      userName: userData.name,
      signInTime: new Date().toISOString(),
    };
    
    const updatedAttendees = attendanceDoc?.attendees ? [...attendanceDoc.attendees, newEntry] : [newEntry];
    
    setDocumentNonBlocking(attendanceRef, { id: today, attendees: updatedAttendees }, { merge: true });
    toast({ title: 'Signed In', description: 'Your attendance has been logged for today.' });
  };

  const handleSignOut = () => {
    if (!user || !currentUserEntry || !attendanceDoc) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot sign out.' });
      return;
    }
    
    const updatedAttendees = attendanceDoc.attendees.map(entry => 
        entry.userId === user.uid ? { ...entry, signOutTime: new Date().toISOString() } : entry
    );

    setDocumentNonBlocking(attendanceRef, { attendees: updatedAttendees }, { merge: true });
    toast({ title: 'Signed Out', description: 'You have successfully signed out for the day.' });
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
        return format(parseISO(isoString), 'HH:mm:ss');
    } catch {
        return 'Invalid Date';
    }
  };


  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time &amp; Attendance</h1>
          <p className="text-muted-foreground">
            Daily sign-in and sign-out sheet for {format(new Date(), 'PPP')}.
          </p>
        </div>
        {!isLoading && user && (
            <div>
                {!currentUserEntry ? (
                    <Button onClick={handleSignIn}>
                        <LogIn className="mr-2" /> Sign In
                    </Button>
                ) : !currentUserEntry.signOutTime ? (
                     <Button onClick={handleSignOut} variant="destructive">
                        <LogOut className="mr-2" /> Sign Out
                    </Button>
                ) : null }
            </div>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance</CardTitle>
          <CardDescription>A log of all user sign-ins and sign-outs for today.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Sign-In Time</TableHead>
                <TableHead>Sign-Out Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                     <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading attendance...
                    </div>
                  </TableCell>
                </TableRow>
              ) : attendanceDoc?.attendees && attendanceDoc.attendees.length > 0 ? (
                attendanceDoc.attendees.map((entry) => (
                  <TableRow key={entry.userId}>
                    <TableCell className="font-medium">{entry.userName}</TableCell>
                    <TableCell>{formatTime(entry.signInTime)}</TableCell>
                    <TableCell>{formatTime(entry.signOutTime)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No one has signed in yet today.
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
