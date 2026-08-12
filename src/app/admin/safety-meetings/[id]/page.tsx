
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Printer, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  FileText
} from 'lucide-react';
import { 
  useDoc, 
  useFirestore, 
  useMemoFirebase 
} from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SafetyMeeting } from '@/lib/types';
import { AltekLogo } from '@/components/altek-logo';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Official Compliance View for Safety Meeting records.
 * Displays uploaded Orange Banner documents as clickable high-visibility links.
 */
export default function ViewSafetyMeetingPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const id = params.id as string;

  // 1. Fetch record data
  const meetingRef = useMemoFirebase(() => (id ? doc(firestore, 'safety_meetings', id) : null), [firestore, id]);
  const { data: meeting, isLoading } = useDoc<SafetyMeeting>(meetingRef);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
        <p className="ml-2 font-bold text-slate-500">Opening Archive...</p>
      </div>
    );
  }

  if (!meeting) return <div className="p-20 text-center font-bold text-slate-400">Meeting record not found.</div>;

  const presentCount = meeting.attendance.filter(a => a.isPresent).length;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background min-h-screen">
      <style>{'@media print { @page { size: portrait; margin: 10mm; } }'}</style>
      
      {/* WEB TOOLBAR (HIDDEN ON PRINT) */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Button variant="ghost" onClick={() => router.push('/admin/safety-meetings')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Log
        </Button>
        <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 shadow-md">
          <Printer className="mr-2 h-4 w-4" /> Export Record to PDF
        </Button>
      </div>

      <Card className="p-8 md:p-12 shadow-2xl border-slate-200 print:shadow-none print:border-none print:p-0 bg-white">
        {/* OFFICIAL COMPLIANCE HEADER */}
        <header className="flex justify-between items-start mb-10 border-b-4 border-slate-900 pb-8">
          <div>
            <AltekLogo className="h-16 w-auto mb-4" />
            <div className="space-y-1">
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Safety Meeting Record</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Compliance Ref: AG-SAF-LOG-001</p>
            </div>
          </div>
          <div className="text-right space-y-2">
            <Badge variant="outline" className="font-mono text-xs border-slate-300 px-3 py-1 bg-slate-50">
              UUID: {meeting.id.slice(0, 8).toUpperCase()}
            </Badge>
            <div className="pt-2">
              <p className="text-lg font-black text-slate-900 leading-none">{meeting.date}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{meeting.time}</p>
            </div>
          </div>
        </header>

        {/* CRITICAL INCIDENTS (ORANGE BANNER DOCUMENTS) */}
        {meeting.orangeBanners && meeting.orangeBanners.length > 0 && (
          <section className="mb-12 space-y-4">
            <div className="flex items-center justify-between bg-orange-600 text-white px-4 py-2 rounded-t-lg">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Critical Safety Flashes (Attached)
                </h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
                {meeting.orangeBanners.map((banner, i) => (
                    <a 
                      key={i} 
                      href={banner.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 bg-orange-50 border-2 border-orange-100 rounded-lg group hover:bg-orange-100 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-orange-600" />
                          <p className="font-black text-orange-950 text-sm">{banner.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-orange-700 uppercase opacity-60 group-hover:opacity-100">Open Full Document</span>
                          <ExternalLink className="h-4 w-4 text-orange-700" />
                        </div>
                    </a>
                ))}
            </div>
          </section>
        )}

        {/* METADATA GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2 py-1 rounded">01. Conductor & Scope</h3>
            <div className="space-y-3 px-1">
              <div className="flex justify-between items-end border-b border-dashed pb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase">Conductor Name:</span>
                <span className="font-bold text-slate-900">{meeting.conductorName}</span>
              </div>
              <div className="flex justify-between items-end border-b border-dashed pb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase">Employee ID:</span>
                <span className="font-mono text-xs">{meeting.conductorId.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-end border-b border-dashed pb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase">Attendance:</span>
                <span className="font-bold text-slate-900">{presentCount} / {meeting.attendance.length} Personnel Present</span>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2 py-1 rounded">02. Agenda Topics</h3>
            <ul className="space-y-2 px-1">
              {meeting.agendaTopics.map((topic, i) => (
                <li key={i} className="text-sm font-bold text-slate-700 flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {topic}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ATTENDANCE TABLE */}
        <section className="space-y-4 mb-16">
          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2 py-1 rounded">03. Official Attendance Registry</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden print:border-slate-300">
            <Table>
              <TableHeader className="bg-slate-50 print:bg-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Technician Name</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-500 tracking-wider">Designation</TableHead>
                  <TableHead className="text-right font-black text-[10px] uppercase text-slate-500 tracking-wider pr-8">Audit Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meeting.attendance.map((person, idx) => (
                  <TableRow key={idx} className="print:border-b border-slate-100 last:border-0 h-10">
                    <TableCell className="font-bold text-slate-800">{person.userName}</TableCell>
                    <TableCell className="text-[11px] text-slate-500 uppercase font-medium">{person.role}</TableCell>
                    <TableCell className="text-right pr-8">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded",
                        person.isPresent ? "bg-emerald-50 text-emerald-700" : "text-slate-300"
                      )}>
                        {person.isPresent ? '✓ PRESENT' : 'ABSENT'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* VERIFICATION BLOCK */}
        <section className="mt-auto pt-10 border-t-4 border-slate-900 print:break-inside-avoid">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-8 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Conductor Verification</h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-lg italic font-medium">
                I, the undersigned, hereby certify that the above personnel were physically present for the safety briefing on the topics listed. 
                This record serves as official documentation of compliance with site safety protocols and Altek Green standard operating procedures.
              </p>
              <div className="pt-6">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Digitally Signing As:</p>
                <p className="text-xl font-black text-slate-900 border-b-2 border-emerald-500 pb-1 w-fit uppercase">{meeting.conductorName}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Signed: {meeting.date} @ {meeting.time}</p>
              </div>
            </div>
            
            <div className="md:col-span-4">
              <div className="border-2 border-slate-100 rounded-xl bg-slate-50 p-6 flex flex-col items-center justify-center min-h-[140px] print:border-slate-300 print:bg-white shadow-inner">
                {meeting.conductorSignature ? (
                  <img src={meeting.conductorSignature} alt="Conductor Signature" className="max-h-28 w-auto object-contain" />
                ) : (
                  <p className="text-[10px] text-slate-300 font-bold uppercase italic">Missing Signature</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-16 text-center border-t-2 border-slate-50 pt-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em]">
              AG COMPLIANCE SYSTEM • SAFE WORK ENVIRONMENT
            </p>
          </div>
          <p className="text-[8px] text-slate-300 font-bold uppercase">
            Altek Green (Pty) Ltd • 163 Van Der Bijl St, Meadowdale • confidential compliance record
          </p>
        </footer>
      </Card>
    </div>
  );
}
