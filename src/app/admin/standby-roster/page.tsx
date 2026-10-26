'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, ShieldAlert, Users, Calendar, Clock, Loader2, Save, Plus, Trash2, X, History, CheckCircle2, FileSpreadsheet, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser, useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, setDoc, deleteDoc, updateDoc, orderBy, addDoc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isValid, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import type { User as AppUser, StandbyShift, Timesheet } from '@/lib/types';
import { WhatsAppShare } from '@/components/ui/whatsapp-share';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { getDefaultPayrollMonth } from '@/lib/payroll-utils';

export default function StandbyRosterPage() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

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

  // FETCH TIMESHEETS (For Backup Callout Qualification & Admin Overrides)
  const timesheetsQuery = useMemoFirebase(() => query(collection(firestore, 'timesheets')), [firestore]);
  const { data: allTimesheets } = useCollection<Timesheet>(timesheetsQuery);
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('ALL');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');

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

  // --- STANDBY ALLOWANCE & CLAIM REPORT LOGIC (Primary + Qualified Backup via Callouts/Overrides) ---
  const standbyClaimReport = useMemo(() => {
    const norm = (s?: string) => (s || '').replace(/\s+/g, ' ').trim();

    // Build lookup per normalized technician name (and userId) for all timesheet entries & overrides
    const userEntriesByNormName: Record<string, { entries: Record<string, any>; overrides: Record<string, string | null> }> = {};

    if (allUsers && allTimesheets) {
      const uidToNormName: Record<string, string> = {};
      allUsers.forEach(u => {
        const n = norm(u.name);
        uidToNormName[u.id] = n;
        if (!userEntriesByNormName[n]) {
          userEntriesByNormName[n] = { entries: {}, overrides: {} };
        }
      });

      allTimesheets.forEach(ts => {
        const n = uidToNormName[ts.userId] || norm(ts.userName);
        if (!userEntriesByNormName[n]) {
          userEntriesByNormName[n] = { entries: {}, overrides: {} };
        }
        if (ts.adminOverrides) {
          Object.entries(ts.adminOverrides).forEach(([shiftId, status]) => {
            userEntriesByNormName[n].overrides[shiftId] = status as string | null;
          });
        }
        if (ts.entries) {
          ts.entries.forEach(entry => {
            if (entry.date) {
              userEntriesByNormName[n].entries[entry.date] = entry;
            }
          });
        }
      });
    }

    const evaluateCallout = (techName: string, startDate: string, endDate: string) => {
      const n = norm(techName);
      const data = userEntriesByNormName[n];
      if (!data) return { hasTrueCallout: false, calloutDates: [] as string[] };

      let hasTrueCallout = false;
      const calloutDates: string[] = [];

      Object.values(data.entries).forEach((entry: any) => {
        const dt = entry.date;
        const isHandoverStart = dt === startDate;
        const isHandoverEnd = dt === endDate;
        const isCoreDay = dt > startDate && dt < endDate;

        if (!isHandoverStart && !isHandoverEnd && !isCoreDay) return;

        if (entry.calloutIn && entry.calloutIn !== '--:--' && entry.calloutIn !== entry.normalOut) {
          if (isCoreDay) {
            hasTrueCallout = true;
            calloutDates.push(`${dt} (${entry.calloutIn}-${entry.calloutOut})`);
          } else if (isHandoverStart) {
            const [h] = entry.calloutIn.split(':').map(Number);
            if (h >= 16) {
              hasTrueCallout = true;
              calloutDates.push(`${dt} (${entry.calloutIn}-${entry.calloutOut})`);
            }
          } else if (isHandoverEnd) {
            const [h] = entry.calloutIn.split(':').map(Number);
            if (h < 9) {
              hasTrueCallout = true;
              calloutDates.push(`${dt} (${entry.calloutIn}-${entry.calloutOut})`);
            }
          }
        }
      });

      return { hasTrueCallout, calloutDates };
    };

    const sortedHistory = [...historyShifts].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const techSummaryMap: Record<string, {
      name: string;
      primaryAssigned: number;
      primaryQualified: number;
      backupAssigned: number;
      backupCalledOut: number;
      backupQualified: number;
      totalClaimableWeeks: number;
    }> = {};

    const ensureTech = (rawName?: string) => {
      const n = norm(rawName);
      if (!n || n === 'None' || n === 'Unassigned' || n === 'Mine Team') return null;
      if (!techSummaryMap[n]) {
        techSummaryMap[n] = {
          name: n,
          primaryAssigned: 0,
          primaryQualified: 0,
          backupAssigned: 0,
          backupCalledOut: 0,
          backupQualified: 0,
          totalClaimableWeeks: 0,
        };
      }
      return techSummaryMap[n];
    };

    const allWeeklyAudit = sortedHistory.map(shift => {
      const priName = norm(shift.primaryTech);
      const bkpName = norm(shift.backupTech);

      // Determine the qualifying payroll month from the end of the standby week (if it flows over into the next month/cycle, it qualifies in the next month)
      const endDt = shift.endDate ? parseISO(shift.endDate) : new Date();
      const qualifyingMonth = isValid(endDt) ? getDefaultPayrollMonth(endDt) : (shift.endDate || '').slice(0, 7);
      const qualifyingMonthLabel = isValid(endDt) ? format(parseISO(`${qualifyingMonth}-01`), 'MMM yyyy') : qualifyingMonth;
      const isRolloverFromPrevMonth = Boolean(shift.startDate && qualifyingMonth && shift.startDate.slice(0, 7) !== qualifyingMonth);

      const priOverride = userEntriesByNormName[priName]?.overrides?.[shift.id] || null;
      const priCallout = evaluateCallout(priName, shift.startDate, shift.endDate);
      const priQualifies = shift.isMineTeamWeek
        ? false
        : priOverride === 'DISQUALIFIED'
          ? false
          : true;

      const bkpOverride = userEntriesByNormName[bkpName]?.overrides?.[shift.id] || null;
      const bkpCallout = bkpName && bkpName !== 'None' && bkpName !== 'Unassigned'
        ? evaluateCallout(bkpName, shift.startDate, shift.endDate)
        : { hasTrueCallout: false, calloutDates: [] as string[] };

      // Updated philosophy: All technicians performing standby duties (both Primary and Backup) qualify for 1 week of standby allowance
      const bkpQualifies = (!bkpName || bkpName === 'None' || bkpName === 'Unassigned')
        ? false
        : bkpOverride === 'DISQUALIFIED'
          ? false
          : true;

      return {
        shift,
        qualifyingMonth,
        qualifyingMonthLabel,
        isRolloverFromPrevMonth,
        priName,
        bkpName: bkpName || 'None',
        priQualifies,
        priOverride,
        priCalloutDates: priCallout.calloutDates,
        bkpHasCallout: bkpCallout.hasTrueCallout,
        bkpCalloutDates: bkpCallout.calloutDates,
        bkpOverride,
        bkpQualifies,
        weekClaimableTotal: (priQualifies ? 1 : 0) + (bkpQualifies ? 1 : 0),
      };
    });

    const availableMonths = Array.from(new Set(allWeeklyAudit.map(w => w.qualifyingMonth).filter(Boolean))).sort();
    const weeklyAudit = selectedMonthFilter === 'ALL'
      ? allWeeklyAudit
      : allWeeklyAudit.filter(w => w.qualifyingMonth === selectedMonthFilter);

    weeklyAudit.forEach(w => {
      const priRec = ensureTech(w.priName);
      if (priRec) {
        priRec.primaryAssigned += 1;
        if (w.priQualifies) {
          priRec.primaryQualified += 1;
          priRec.totalClaimableWeeks += 1;
        }
      }

      const bkpRec = ensureTech(w.bkpName);
      if (bkpRec) {
        bkpRec.backupAssigned += 1;
        if (w.bkpHasCallout) bkpRec.backupCalledOut += 1;
        if (w.bkpQualifies) {
          bkpRec.backupQualified += 1;
          bkpRec.totalClaimableWeeks += 1;
        }
      }
    });

    const techSummaries = Object.values(techSummaryMap).sort((a, b) => b.totalClaimableWeeks - a.totalClaimableWeeks);
    const totals = techSummaries.reduce((acc, curr) => ({
      primaryAssigned: acc.primaryAssigned + curr.primaryAssigned,
      primaryQualified: acc.primaryQualified + curr.primaryQualified,
      backupAssigned: acc.backupAssigned + curr.backupAssigned,
      backupCalledOut: acc.backupCalledOut + curr.backupCalledOut,
      backupQualified: acc.backupQualified + curr.backupQualified,
      totalClaimableWeeks: acc.totalClaimableWeeks + curr.totalClaimableWeeks,
    }), {
      primaryAssigned: 0,
      primaryQualified: 0,
      backupAssigned: 0,
      backupCalledOut: 0,
      backupQualified: 0,
      totalClaimableWeeks: 0,
    });

    return { techSummaries, weeklyAudit, totals, availableMonths };
  }, [historyShifts, allUsers, allTimesheets, selectedMonthFilter]);

  const handleExportClaimReport = () => {
    const summaryRows = standbyClaimReport.techSummaries.map(t => ({
      'Technician': t.name,
      'Primary Shifts Done': t.primaryAssigned,
      'Primary Qualified (Claimable)': t.primaryQualified,
      'Backup Shifts Assigned': t.backupAssigned,
      'Backup Shifts with Callout': t.backupCalledOut,
      'Backup Qualified (Claimable)': t.backupQualified,
      'Total Claimable Allowances (Weeks)': t.totalClaimableWeeks,
    }));
    summaryRows.push({
      'Technician': 'TOTAL',
      'Primary Shifts Done': standbyClaimReport.totals.primaryAssigned,
      'Primary Qualified (Claimable)': standbyClaimReport.totals.primaryQualified,
      'Backup Shifts Assigned': standbyClaimReport.totals.backupAssigned,
      'Backup Shifts with Callout': standbyClaimReport.totals.backupCalledOut,
      'Backup Qualified (Claimable)': standbyClaimReport.totals.backupQualified,
      'Total Claimable Allowances (Weeks)': standbyClaimReport.totals.totalClaimableWeeks,
    });

    const detailRows = standbyClaimReport.weeklyAudit.map((w, idx) => ({
      '#': idx + 1,
      'Start Date': w.shift.startDate,
      'End Date': w.shift.endDate,
      'Qualifying Payroll Month': w.qualifyingMonthLabel,
      'Rollover From Prev Month': w.isRolloverFromPrevMonth ? 'Yes (Qualifies in Next Month)' : 'No',
      'Primary Technician': w.priName,
      'Primary Qualified': w.priQualifies ? 'YES (1 Week)' : 'NO (0)',
      'Backup Technician': w.bkpName,
      'Backup Callout Logged': w.bkpCalloutDates.length > 0 ? w.bkpCalloutDates.join('; ') : 'No Callout',
      'Admin Override (Backup)': w.bkpOverride || 'Automatic',
      'Backup Qualified': w.bkpQualifies ? 'YES (1 Week)' : 'NO (0)',
      'Total Claimable (Weeks)': w.weekClaimableTotal,
    }));

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary Per Technician');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Weekly Audit Log');
    XLSX.writeFile(wb, `Standby_Allowance_Claim_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

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
          data.map((shift, index) => (
            <TableRow 
              key={shift.id} 
              className={cn(
                activeShift?.id === shift.id && "bg-emerald-50/50 border-l-4 border-l-emerald-500",
                index >= 3 && "share-hide-row"
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

  const handleShareAsImage = async () => {
    if (!contentRef.current) return;
    setIsSharing(true);
    try {
      // Temporarily hide action buttons during screenshot
      const buttonsToHide = contentRef.current.querySelectorAll('.screenshot-hide');
      buttonsToHide.forEach((el: any) => el.style.opacity = '0');

      // Hide extra rows
      const rowsToHide = contentRef.current.querySelectorAll('.share-hide-row');
      rowsToHide.forEach((el: any) => el.style.display = 'none');

      // Convert native inputs/selects to static spans to prevent html2canvas cropping bugs
      const formElements = contentRef.current.querySelectorAll('input, select');
      const tempSpans: HTMLSpanElement[] = [];
      formElements.forEach((el: any) => {
        const span = document.createElement('span');
        span.textContent = el.value;
        span.className = 'font-mono text-sm px-2 py-1 text-slate-800';
        el.parentNode.insertBefore(span, el);
        el.style.display = 'none';
        tempSpans.push(span);
      });

      const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: '#f8fafc' });
      
      // Restore everything
      buttonsToHide.forEach((el: any) => el.style.opacity = '1');
      rowsToHide.forEach((el: any) => el.style.display = '');
      formElements.forEach((el: any) => el.style.display = '');
      tempSpans.forEach(span => span.remove());

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Could not create image blob");
        
        const file = new File([blob], 'standby-roster.png', { type: 'image/png' });
        
        // Try Web Share API (Mobile native sharing)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Standby Roster',
              files: [file]
            });
            return;
          } catch (shareErr) {
            console.log('Share API error / cancelled', shareErr);
          }
        }
        
        // Fallback for Desktop: Try clipboard, if fails download
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          toast({ title: "Copied to Clipboard", description: "Image copied to clipboard. You can now paste it into WhatsApp Desktop.", variant: "default" });
        } catch (clipboardErr) {
          // Download fallback
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'standby-roster.png';
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: "Image Downloaded", description: "Image downloaded. You can now attach it to WhatsApp.", variant: "default" });
        }
      }, 'image/png');

    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to capture image.", variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div ref={contentRef} className="flex flex-col gap-8 p-4 sm:p-8 max-w-6xl mx-auto bg-slate-50 min-h-screen">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Standby Roster</h1>
          <p className="text-muted-foreground">Explicit site shift management (Database Driven).</p>
        </div>
        <div className="flex items-center gap-2 screenshot-hide">
          {activeShift && (
            <Button onClick={handleShareAsImage} disabled={isSharing} className="bg-emerald-500 hover:bg-emerald-600 text-white">
              {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>}
              Share Update
            </Button>
          )}
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
        <TabsList className="grid w-full grid-cols-3 max-w-2xl mb-4 print:hidden">
          <TabsTrigger value="active" className="gap-2">
            <Calendar className="h-4 w-4" />
            Active & Upcoming
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History ({historyShifts.length})
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Allowance & Claim Summary
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

        <TabsContent value="summary" className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-emerald-50/40 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Standby Allowance & Client Claim Summary (Since Feb 2026)
                </CardTitle>
                <CardDescription>
                  All technicians who perform standby duties (both Primary and Backup) qualify for 1 week of standby allowance. When a standby week flows over into the next month/cycle, it qualifies in the following month.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase text-slate-500">Payroll Month:</span>
                  <select
                    value={selectedMonthFilter}
                    onChange={(e) => setSelectedMonthFilter(e.target.value)}
                    className="h-8 px-2.5 border rounded-md text-xs font-bold bg-white"
                  >
                    <option value="ALL">All Months (Since Feb 2026)</option>
                    {standbyClaimReport.availableMonths.map(m => (
                      <option key={m} value={m}>{format(parseISO(`${m}-01`), 'MMMM yyyy')}</option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportClaimReport} className="gap-2 bg-white">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Export Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 bg-white">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead className="font-bold text-slate-700">Technician</TableHead>
                    <TableHead className="text-center font-bold text-blue-700">Primary Shifts Done</TableHead>
                    <TableHead className="text-center font-bold text-blue-800 bg-blue-50/40">Primary Qualified</TableHead>
                    <TableHead className="text-center font-bold text-orange-700">Backup Shifts Assigned</TableHead>
                    <TableHead className="text-center font-bold text-orange-800">Backup w/ Callout</TableHead>
                    <TableHead className="text-center font-bold text-emerald-700 bg-emerald-50/40">Backup Qualified</TableHead>
                    <TableHead className="text-right pr-6 font-black text-slate-900">Total Claimable Allowances</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standbyClaimReport.techSummaries.map((row) => (
                    <TableRow key={row.name} className="hover:bg-slate-50/60">
                      <TableCell className="font-bold text-slate-800">{row.name}</TableCell>
                      <TableCell className="text-center font-mono">{row.primaryAssigned}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-blue-700 bg-blue-50/20">{row.primaryQualified} wks</TableCell>
                      <TableCell className="text-center font-mono">{row.backupAssigned}</TableCell>
                      <TableCell className="text-center font-mono text-orange-700">{row.backupCalledOut}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-emerald-700 bg-emerald-50/20">{row.backupQualified} wks</TableCell>
                      <TableCell className="text-right pr-6 font-mono font-black text-base text-slate-900">
                        {row.totalClaimableWeeks} {row.totalClaimableWeeks === 1 ? 'Week' : 'Weeks'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-slate-100 font-black">
                  <TableRow>
                    <TableCell className="uppercase text-xs font-black text-slate-900">Total Claimable From Client</TableCell>
                    <TableCell className="text-center font-mono">{standbyClaimReport.totals.primaryAssigned}</TableCell>
                    <TableCell className="text-center font-mono text-blue-800">{standbyClaimReport.totals.primaryQualified} wks</TableCell>
                    <TableCell className="text-center font-mono">{standbyClaimReport.totals.backupAssigned}</TableCell>
                    <TableCell className="text-center font-mono text-orange-800">{standbyClaimReport.totals.backupCalledOut}</TableCell>
                    <TableCell className="text-center font-mono text-emerald-800">{standbyClaimReport.totals.backupQualified} wks</TableCell>
                    <TableCell className="text-right pr-6 font-mono text-lg text-emerald-700">
                      {standbyClaimReport.totals.totalClaimableWeeks} Weeks
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">Week-by-Week Standby & Backup Callout Audit Log</CardTitle>
                <CardDescription>Shows every completed standby week from Feb 2026, including backup callout dates and timesheet overrides.</CardDescription>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <span className="text-xs font-bold uppercase text-slate-400">Filter Tech:</span>
                <select
                  value={selectedTechFilter}
                  onChange={(e) => setSelectedTechFilter(e.target.value)}
                  className="h-8 px-3 border rounded-md text-xs font-bold bg-white"
                >
                  <option value="ALL">All Technicians ({standbyClaimReport.weeklyAudit.length} weeks)</option>
                  {standbyClaimReport.techSummaries.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Qualifying Month</TableHead>
                    <TableHead>Primary Responder (1 Wk)</TableHead>
                    <TableHead>Backup Support (1 Wk)</TableHead>
                    <TableHead>Backup Callouts Logged</TableHead>
                    <TableHead className="text-center">Backup Status</TableHead>
                    <TableHead className="text-right pr-6">Claimable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standbyClaimReport.weeklyAudit
                    .filter(w => selectedTechFilter === 'ALL' || w.priName === selectedTechFilter || w.bkpName === selectedTechFilter)
                    .map((w, idx) => (
                      <TableRow key={w.shift.id} className={cn(w.bkpQualifies && "bg-emerald-50/30")}>
                        <TableCell className="font-mono text-xs text-slate-400">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-xs font-bold text-slate-700 whitespace-nowrap">
                          {w.shift.startDate} — {w.shift.endDate}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col">
                            <Badge variant="outline" className="w-fit text-[10px] font-bold border-slate-300 text-slate-700 bg-white">
                              {w.qualifyingMonthLabel}
                            </Badge>
                            {w.isRolloverFromPrevMonth && (
                              <span className="text-[9px] text-blue-600 font-semibold mt-0.5">Rollover → Next Month</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-800">{w.priName}</span>
                            {w.priQualifies ? (
                              <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">1 Wk</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-red-200 text-red-600 bg-red-50">Disqualified</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-slate-700">{w.bkpName}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {w.bkpCalloutDates.length > 0 ? (
                            <span className="text-emerald-700 font-bold">{w.bkpCalloutDates.join(', ')}</span>
                          ) : (
                            <span className="text-slate-400 italic">No callout</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {w.bkpQualifies ? (
                            <Badge className="bg-emerald-600 text-[10px]">QUALIFIED (+1 Wk)</Badge>
                          ) : w.bkpOverride === 'DISQUALIFIED' ? (
                            <Badge variant="outline" className="text-[10px] border-red-200 text-red-600">DISQUALIFIED (Override)</Badge>
                          ) : (
                            <span className="text-xs text-slate-400">0 Wks</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6 font-mono font-bold text-sm">
                          {w.weekClaimableTotal} {w.weekClaimableTotal === 1 ? 'Wk' : 'Wks'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
