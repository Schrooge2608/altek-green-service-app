'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Plus, 
  Search, 
  Loader2, 
  ShieldCheck, 
  Eye, 
  Users, 
  Calendar as CalendarIcon,
  Pencil,
  FileText
} from 'lucide-react';
import { 
  useCollection, 
  useFirebase, 
  useMemoFirebase, 
  useUser,
  useDoc
} from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { SafetyMeeting, User } from '@/lib/types';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Safety Compliance Log: The landing page for the Safety Meeting module.
 * Provides an archive list of all saved meetings and a portal to create new records.
 * STRICT ENFORCEMENT: Dynamically routes to Editor for drafts and View for finalized records.
 */
export default function SafetyMeetingsTrackerPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = React.useState('');

  // 1. Permissions Check
  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRef);
  const isManagement = userData?.role && ['Admin', 'Superadmin', 'Services Manager', 'Site Supervisor', 'Corporate Manager'].includes(userData.role);

  // 2. Fetch Meetings
  const meetingsQuery = useMemoFirebase(
    () => query(collection(firestore, 'safety_meetings'), orderBy('date', 'desc')),
    [firestore]
  );
  const { data: meetings, isLoading } = useCollection<SafetyMeeting>(meetingsQuery);

  const filteredMeetings = useMemo(() => {
    if (!meetings) return [];
    return meetings.filter(m => 
      (m.conductorName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (m.date || '').includes(searchTerm)
    );
  }, [meetings, searchTerm]);

  /**
   * FORCE BADGE STYLING
   * Uses high-visibility yellow for drafts to warn that they are not yet compliant.
   */
  const getStatusBadge = (status: string) => {
    if (status === 'draft') {
      return (
        <Badge className="bg-amber-500 text-white border-none uppercase text-[10px] font-black px-2 shadow-sm">
          DRAFT (PENDING)
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-600 text-white border-none uppercase text-[10px] font-black px-2">
        FINALIZED (COMPLIANT)
      </Badge>
    );
  };

  if (!isManagement && !isLoading && userData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <h2 className="text-2xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-muted-foreground mt-2">Only administrators and site managers can view safety logs.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 bg-background">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Safety Compliance Log</h1>
          <p className="text-muted-foreground">Historical ledger of monthly site safety briefings.</p>
        </div>
        <Link href="/admin/safety-meetings/new">
          <Button className="bg-primary">
            <Plus className="mr-2 h-4 w-4" /> Record New Meeting
          </Button>
        </Link>
      </header>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Compliance Archives
            </CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by date or conductor..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="pl-6 font-bold">Date / Status</TableHead>
                <TableHead className="font-bold">Conductor</TableHead>
                <TableHead className="font-bold">Attendance</TableHead>
                <TableHead className="font-bold">Topics Discussed</TableHead>
                <TableHead className="text-right pr-6 font-bold">Audit Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6 text-slate-300" /></TableCell></TableRow>
              ) : filteredMeetings.length > 0 ? (
                filteredMeetings.map(meeting => (
                  <TableRow key={meeting.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-bold text-slate-800 pl-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-3 w-3 text-primary" />
                          {meeting.date}
                        </div>
                        {getStatusBadge(meeting.status)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-600">{meeting.conductorName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-slate-400" />
                        <span className="text-sm font-semibold">{meeting.attendance ? meeting.attendance.filter(a => a.isPresent).length : 0} / {meeting.attendance ? meeting.attendance.length : 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-slate-500 italic">
                      {meeting.agendaTopics?.join(', ') || 'No topics listed'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {/* FORCE CONDITIONAL BUTTONS */}
                      {meeting.status === 'draft' ? (
                        <Link href={`/admin/safety-meetings/new?id=${meeting.id}`}>
                          <Button variant="outline" size="sm" className="bg-white text-amber-700 border-amber-500 hover:bg-amber-50 font-black shadow-sm">
                            <Pencil className="mr-2 h-4 w-4" /> RESUME DRAFT
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/admin/safety-meetings/${meeting.id}`}>
                          <Button variant="outline" size="sm" className="bg-white text-emerald-700 border-emerald-500 hover:bg-amber-50 font-black shadow-sm">
                            <FileText className="mr-2 h-4 w-4" /> VIEW COMPLIANCE RECORD
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">
                    No safety briefing records found in the database.
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
