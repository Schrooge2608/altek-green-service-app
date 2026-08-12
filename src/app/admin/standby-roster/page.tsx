'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, ShieldAlert, Users, Calendar, Clock, Loader2, Save, Plus, Trash2, X, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, setDoc, deleteDoc, updateDoc, orderBy, addDoc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isValid, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import type { User as AppUser, StandbyShift } from '@/lib/types';
import { WhatsAppShare } from '@/components/ui/whatsapp-share';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function StandbyRosterPage() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- SAFE FORMATTING HELPER ---
  const safeFormat = (dateStr: string | undefined | null, formatStr: string) => {
    if (!dateStr) return 'Pending';
    try {
      const d = parseISO(dateStr);
      if (!isValid(d)) return 'Invalid Date';
      return format(d, formatStr);
    } catch (e) {
      return 'Invalid Date';
    }
  };

  // PERMISSION CHECK (With explicit admin@altekgreen.com fallback)
  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<AppUser>(userRoleRef);
  const isSuperAdmin = userData?.role === 'Admin' || userData?.role === 'Superadmin' || user?.email === 'admin@altekgreen.com';
  const isSiteSupervisor = userData?.role === 'Site Supervisor';
  const canEditActive = isSuperAdmin || isSiteSupervisor;
  const canEditHistory = isSuperAdmin;

  // FETCH USERS (For technician dropdowns)
  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'users')), [firestore]);
  const { data: allUsers } = useCollection<AppUser>(usersQuery);

  const technicians = useMemo(() => {
    if (!allUsers) return [];
    const techRoles = ['Technician', 'Junior Technician', 'Technologist', 'Power systems engineer', 'HVAC product specialist', 'Site Supervisor'];
    return allUsers.filter(u => techRoles.some(role => u.role?.includes(role))).sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsers]);

  // FETCH SHIFTS (Explicit database records)
  const shiftsQuery = useMemoFirebase(() => query(collection(firestore, 'standby_shifts'), orderBy('startDate', 'asc')), [firestore]);
  const { data: shifts, isLoading: shiftsLoading } = useCollection<StandbyShift>(shiftsQuery);

  // --- ACTIVE SHIFT LOGIC (The "Source of Truth" for Banner AND Table Highlighting) ---
  const activeShift = useMemo(() => {
    if (!isMounted || !shifts) return null;
    const now = new Date();
    const currentDay = now.getDay(); // 4 = Thursday
    const currentHour = now.getHours();
    const todayStr = format(now, 'yyyy-MM-dd');

    // 1. Switchover Day Logic: If it's Thursday and past 07:00, show the INCOMING rotation
    if (currentDay === 4 && currentHour >= 7) {
      const incomingShift = shifts.find(s => s.startDate === todayStr);
      if (incomingShift) return incomingShift;
    }

    // 2. Standard Logic: Find the shift covering the exact 16:00 Thu - 07:00 next Thu window
    return shifts.find(shift => {
      if (!shift.startDate || !shift.endDate) return false;
      try {
        const start = parseISO(shift.startDate);
        const end = parseISO(shift.endDate);
        if (!isValid(start) || !isValid(end)) return false;
        
        // Exact Boundaries
        const exactStart = new Date(start); exactStart.setHours(16, 0, 0, 0);
        const exactEnd = new Date(end); exactEnd.setHours(7, 0, 0, 0);
        
        return now >= exactStart && now <= exactEnd;
      } catch {
        return false;
      }
    });
  }, [isMounted, shifts]);

  // --- TAB FILTERING LOGIC (Using same 07:00 threshold) ---
  const { activeShifts, historyShifts } = useMemo(() => {
    if (!isMounted || !shifts) return { activeShifts: [], historyShifts: [] };
    
    const now = new Date();
    const active: StandbyShift[] = [];
    const history: StandbyShift[] = [];

    shifts.forEach(shift => {
      if (!shift.endDate) {
        active.push(shift);
        return;
      }

      try {
        const end = parseISO(shift.endDate);
        if (!isValid(end)) {
          active.push(shift);
          return;
        }

        // Precision rollover: Thursday 07:00
        const rolloverThreshold = new Date(end);
        rolloverThreshold.setHours(7, 0, 0, 0);

        if (now < rolloverThreshold) {
          active.push(shift);
        } else {
          history.push(shift);
        }
      } catch {
        active.push(shift);
      }
    });

    return { 
      activeShifts: active, 
      historyShifts: [...history].sort((a, b) => b.startDate.localeCompare(a.startDate)) 
    };
  }, [isMounted, shifts]);

  // --- CRUD ACTIONS ---
  const handleAddShift = async () => {
    try {
      let nextStart = format(new Date(), 'yyyy-MM-dd');
      let nextEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      if (shifts && shifts.length > 0) {
        const lastEndStr = shifts[shifts.length - 1].endDate;
        if (lastEndStr) {
          const lastEnd = parseISO(lastEndStr);
          if (isValid(lastEnd)) {
            // FIX: Start date equals the last end date. End date is exactly 7 days later.
            nextStart = format(lastEnd, 'yyyy-MM-dd');
            nextEnd = format(addDays(lastEnd, 7), 'yyyy-MM-dd');
          }
        }
      }

      await addDoc(collection(firestore, 'standby_shifts'), {
        startDate: nextStart,
        endDate: nextEnd,
        primaryTech: 'Mine Team',
        backupTech: 'Unassigned',
        isMineTeamWeek: true
      });
      toast({ title: "Shift Created", description: "New blank shift added to the list." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Failed to Add", description: e.message });
    }
  };

  const handleUpdateShift = async (id: string, data: Partial<StandbyShift>) => {
    try {
      const shiftRef = doc(firestore, 'standby_shifts', id);
      if (data.primaryTech === 'Mine Team') data.isMineTeamWeek = true;
      else if (data.primaryTech && data.primaryTech !== 'Mine Team') data.isMineTeamWeek = false;
      await updateDoc(shiftRef, data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Update Failed", description: e.message });
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift record?")) return;
    try {
      await deleteDoc(doc(firestore, 'standby_shifts', id));
      toast({ title: "Shift Removed" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Delete Failed", description: e.message });
    }
  };

  const ShiftTable = ({ data, emptyMessage, isEditable }: { data: StandbyShift[], emptyMessage: string, isEditable: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Primary On-Call</TableHead>
          <TableHead>Backup</TableHead>
          {isEditable && <TableHead className="w-[50px]"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length > 0 ? (
          data.map((shift) => (
            <TableRow 
              key={shift.id} 
              className={cn(
                activeShift?.id === shift.id && "bg-emerald-50/50 border-l-4 border-l-emerald-500"
              )}
            >
              <TableCell>
                {isEditable ? (
                  <Input 
                    type="date" 
                    defaultValue={shift.startDate || ''} 
                    onBlur={(e) => {
                      if (e.target.value !== shift.startDate) {
                        handleUpdateShift(shift.id, { startDate: e.target.value });
                      }
                    }}
                    className="h-8 py-1 text-sm bg-white"
                  />
                ) : (
                  <span className="font-mono text-slate-600">{safeFormat(shift.startDate, 'EEE, d MMM yyyy')}</span>
                )}
              </TableCell>
              <TableCell>
                {isEditable ? (
                  <Input 
                    type="date" 
                    defaultValue={shift.endDate || ''} 
                    onBlur={(e) => {
                      if (e.target.value !== shift.endDate) {
                        handleUpdateShift(shift.id, { endDate: e.target.value });
                      }
                    }}
                    className="h-8 py-1 text-sm bg-white"
                  />
                ) : (
                  <span className="font-mono text-slate-400">{safeFormat(shift.endDate, 'EEE, d MMM yyyy')}</span>
                )}
              </TableCell>
              <TableCell>
                {isEditable ? (
                  <select 
                    value={shift.primaryTech}
                    onChange={(e) => handleUpdateShift(shift.id, { primaryTech: e.target.value })}
                    className="w-full h-8 px-2 border rounded-md text-sm font-bold bg-white"
                  >
                    <option value="Mine Team">Mine Team</option>
                    {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                ) : (
                  <Badge variant={shift.isMineTeamWeek ? "outline" : "default"} className={cn(shift.isMineTeamWeek ? "text-orange-700 border-orange-200" : "bg-emerald-600")}>
                    {shift.primaryTech}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {isEditable ? (
                  <select 
                    value={shift.backupTech || "None"}
                    onChange={(e) => handleUpdateShift(shift.id, { backupTech: e.target.value })}
                    className="w-full h-8 px-2 border rounded-md text-sm bg-white"
                  >
                    <option value="None">None</option>
                    {technicians.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                ) : (
                  <span className="text-sm font-medium text-slate-600">{shift.backupTech || 'None'}</span>
                )}
              </TableCell>
              {isEditable && (
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteShift(shift.id)} className="text-slate-300 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={isEditable ? 5 : 4} className="text-center h-24 text-slate-400 italic">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  const waRosterMsg = activeShift ? `
*🚨 STANDBY ROSTER UPDATE*
---------------------------
🗓️ *PERIOD:* ${safeFormat(activeShift.startDate, 'd MMM')} - ${safeFormat(activeShift.endDate, 'd MMM yyyy')}
✅ *PRIMARY:* ${activeShift.primaryTech}
🛡️ *BACKUP:* ${activeShift.backupTech || 'None'}
🏢 *TEAM:* ${activeShift.isMineTeamWeek ? 'Mining Department' : 'Altek Green'}

${activeShift.isMineTeamWeek ? 'Call-outs are handled internally by the Mine primary this week.' : 'Please contact the Altek primary for any call-outs.'}`.trim() : '';

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Standby Roster</h1>
          <p className="text-muted-foreground">Explicit site shift management (Database Driven).</p>
        </div>
        <div className="flex items-center gap-2">
          {activeShift && <WhatsAppShare text={waRosterMsg} label="Share Update" />}
          {canEditActive && (
            <Button onClick={handleAddShift} className="bg-primary">
              <Plus className="mr-2 h-4 w-4" /> Add Upcoming Shift
            </Button>
          )}
        </div>
      </header>

      {/* PRIMARY ACTIVE SECTION */}
      {!isMounted || shiftsLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : activeShift ? (
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Currently On Call</h2>
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                  <Clock className="h-3 w-3" />
                  Active until {safeFormat(activeShift.endDate, 'EEEE, d MMM yyyy')} at 07:00
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Rotation Period</span>
              <Badge variant="outline" className="text-lg py-1 px-4 border-primary/20 text-primary bg-primary/5 font-mono">
                {safeFormat(activeShift.startDate, 'd MMM')} — {safeFormat(activeShift.endDate, 'd MMM yyyy')}
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className={cn(
              "p-8 border-2 rounded-2xl relative overflow-hidden group",
              activeShift.isMineTeamWeek ? "bg-orange-50 border-orange-200" : "bg-emerald-50 border-emerald-200"
            )}>
              <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
                {activeShift.isMineTeamWeek ? <ShieldAlert className="h-32 w-32 text-orange-600" /> : <Users className="h-32 w-32 text-emerald-600" />}
              </div>
              <p className={cn("text-xs font-bold uppercase tracking-widest mb-3", activeShift.isMineTeamWeek ? "text-orange-800" : "text-emerald-800")}>Primary On Call</p>
              <p className="text-4xl font-black text-slate-900 mb-2">{activeShift.primaryTech}</p>
              <p className={cn("text-lg font-medium", activeShift.isMineTeamWeek ? "text-orange-700" : "text-emerald-700")}>
                {activeShift.isMineTeamWeek ? 'Internal Plant Team' : 'Altek Green Team'}
              </p>
            </div>
            <div className="p-8 bg-slate-50 border-2 border-slate-200 rounded-2xl flex flex-col justify-center">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Backup Technician</p>
              <p className="text-3xl font-bold text-slate-800 mb-2">{activeShift.backupTech || 'None'}</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Available for support if the primary responder requires assistance.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 italic border-2 border-dashed rounded-xl bg-slate-50">
          No active shift found for today. Use "+ Add Upcoming Shift" to begin the schedule.
        </div>
      )}

      {/* SHIFT TRACKER TABS */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-4">
          <TabsTrigger value="active" className="gap-2">
            <Calendar className="h-4 w-4" />
            Active & Upcoming
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Current Rotation Schedule</CardTitle>
              <CardDescription>
                {canEditActive 
                  ? "Modify active or future dates directly below. Changes are saved automatically." 
                  : "Review upcoming standby assignments."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ShiftTable 
                data={activeShifts} 
                emptyMessage='No active or upcoming shifts found.' 
                isEditable={canEditActive}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-lg font-bold text-slate-700">Rotation History</CardTitle>
              <CardDescription>Archived records of past standby rotations.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 opacity-80">
              <ShiftTable 
                data={historyShifts} 
                emptyMessage='No historical shift records found.' 
                isEditable={canEditHistory}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}