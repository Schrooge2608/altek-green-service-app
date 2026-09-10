'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
  Loader2, 
  ArrowLeft,
  Printer
} from 'lucide-react';
import { useDoc, useFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SafetyMeeting } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';

export default function SafetyMeetingViewPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const meetingId = params.id as string;

  const meetingRef = useMemo(() => (meetingId ? doc(firestore, 'safety_meetings', meetingId) : null), [firestore, meetingId]);
  const { data: meeting, isLoading } = useDoc<SafetyMeeting>(meetingRef);

  const presentList = meeting?.attendance.filter(a => a.isPresent).map(a => a.userName) || [];
  const apologiesList = meeting?.attendance.filter(a => !a.isPresent).map(a => a.userName) || [];

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  }

  if (!meeting) {
    return <div className="p-8 text-center text-muted-foreground">Meeting record not found.</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1200px] mx-auto pb-32">
      {/* NO-PRINT HEADER */}
      <div className="flex justify-between items-center mb-8 print:hidden">
        <Button variant="ghost" onClick={() => router.push('/admin/safety-meetings')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Button onClick={handlePrint} className="bg-primary">
          <Printer className="h-4 w-4 mr-2" /> Print Minutes
        </Button>
      </div>

      <div className="bg-white print:shadow-none shadow-xl border p-8 space-y-8 text-black" id="print-area">
        
        {/* HEADER / LOGO ROW */}
        <div className="flex justify-between items-center border-b pb-4">
          <div className="flex items-center gap-4">
            {/* Altek Logo */}
            <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center">
              <span className="text-white font-black text-xl">AG</span>
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Altek Green</h1>
              <p className="text-sm font-medium text-slate-500">Minutes of HSE Meeting</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold">{meeting.monthYear || format(parseISO(meeting.date), 'MMMM yyyy')}</h2>
          </div>
        </div>

        {/* METADATA TABLE */}
        <div className="border border-slate-300 rounded overflow-hidden">
          <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-300 font-bold text-xs uppercase text-slate-600">
            <div className="col-span-4 p-2 border-r border-slate-300">Meeting Details</div>
            <div className="col-span-3 p-2 border-r border-slate-300 text-center">Present</div>
            <div className="col-span-3 p-2 border-r border-slate-300 text-center">Apologies</div>
            <div className="col-span-2 p-2 text-center">Approved By</div>
          </div>
          
          <div className="grid grid-cols-12 text-sm">
            {/* Column 1: Meeting Details */}
            <div className="col-span-4 border-r border-slate-300 p-0 flex flex-col h-full">
              <div className="grid grid-cols-3 border-b border-slate-200 flex-1">
                <div className="col-span-1 p-2 font-bold bg-slate-50 border-r border-slate-200">Venue:</div>
                <div className="col-span-2 p-2">{meeting.venue || 'N/A'}</div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200 flex-1">
                <div className="col-span-1 p-2 font-bold bg-slate-50 border-r border-slate-200">Time:</div>
                <div className="col-span-2 p-2">{meeting.time}</div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200 flex-1">
                <div className="col-span-1 p-2 font-bold bg-slate-50 border-r border-slate-200">Date:</div>
                <div className="col-span-2 p-2">{format(parseISO(meeting.date), 'd MMMM yyyy')}</div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200 flex-1">
                <div className="col-span-1 p-2 font-bold bg-slate-50 border-r border-slate-200">Minutes:</div>
                <div className="col-span-2 p-2">{meeting.conductorName}</div>
              </div>
              <div className="grid grid-cols-3 flex-1">
                <div className="col-span-1 p-2 font-bold bg-slate-50 border-r border-slate-200">Reviewer:</div>
                <div className="col-span-2 p-2">{meeting.reviewerName || 'N/A'}</div>
              </div>
            </div>

            {/* Column 2: Present */}
            <div className="col-span-3 border-r border-slate-300 p-2 text-xs">
              <ul className="list-none space-y-1">
                {presentList.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>

            {/* Column 3: Apologies */}
            <div className="col-span-3 border-r border-slate-300 p-2 text-xs">
              <ul className="list-none space-y-1">
                {apologiesList.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>

            {/* Column 4: Approval */}
            <div className="col-span-2 p-2 flex items-end justify-center pb-4">
              {meeting.conductorSignature ? (
                <div className="flex flex-col items-center">
                  <img src={meeting.conductorSignature} alt="Sig" className="h-12 object-contain" />
                  <span className="text-[10px] text-slate-500 italic mt-1 text-center">Signed by {meeting.conductorName}</span>
                </div>
              ) : (
                <div className="w-full h-12 border-b border-slate-400 border-dashed"></div>
              )}
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="mt-8">
          <Table className="border border-slate-300">
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead className="w-[50px] font-bold text-slate-700 border-r border-slate-300 text-xs py-2">ITEM</TableHead>
                <TableHead className="w-[150px] font-bold text-slate-700 border-r border-slate-300 text-xs py-2">MINUTE</TableHead>
                <TableHead className="font-bold text-slate-700 border-r border-slate-300 text-xs py-2">COMMENTS</TableHead>
                <TableHead className="w-[120px] font-bold text-slate-700 border-r border-slate-300 text-xs py-2">ACTION</TableHead>
                <TableHead className="w-[120px] font-bold text-slate-700 border-r border-slate-300 text-xs py-2">STATUS</TableHead>
                <TableHead className="w-[120px] font-bold text-slate-700 text-xs py-2">COMP. DATE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meeting.items && meeting.items.length > 0 ? (
                meeting.items.map((item, index) => (
                  <TableRow key={index} className="align-top border-b border-slate-300 hover:bg-transparent">
                    <TableCell className="border-r border-slate-300 font-bold p-2 text-xs">{item.itemNumber}</TableCell>
                    <TableCell className="border-r border-slate-300 font-bold underline p-2 text-xs">{item.minute}</TableCell>
                    <TableCell className="border-r border-slate-300 p-2 text-xs whitespace-pre-wrap">{item.comments}</TableCell>
                    <TableCell className="border-r border-slate-300 p-2 text-xs text-center">{item.action}</TableCell>
                    <TableCell className="border-r border-slate-300 p-2 text-xs text-center">{item.status}</TableCell>
                    <TableCell className="p-2 text-xs text-center">{item.compDate}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">No minutes recorded.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ORANGE BANNERS (ATTACHMENTS) */}
        {meeting.orangeBanners && meeting.orangeBanners.length > 0 && (
          <div className="mt-8 border border-orange-200 rounded p-4 bg-orange-50/50 print:bg-white print:border-none print:p-0">
            <h3 className="font-bold text-sm uppercase text-orange-800 mb-4 print:text-black">Attachments / Orange Banners</h3>
            <ul className="space-y-2">
              {meeting.orangeBanners.map((banner, i) => (
                <li key={i} className="text-sm">
                  <a href={banner.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-2">
                    📄 {banner.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
