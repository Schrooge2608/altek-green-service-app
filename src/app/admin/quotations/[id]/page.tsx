'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Pencil, Loader2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import Link from 'next/link';

export default function ViewQuotePage() {
  const router = useRouter();
  const params = useParams();
  const { firestore } = useFirebase();

  // Fetch specific quote by ID
  const quoteRef = useMemoFirebase(
    () => (params.id ? doc(firestore, 'quotations', params.id as string) : null),
    [firestore, params.id]
  );
  const { data: quote, isLoading } = useDoc(quoteRef);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        <p className="text-slate-500">Loading Preview...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-2xl font-bold">Quote not found</h1>
        <Button onClick={() => router.push('/admin/quotations')}>Back to List</Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-background min-h-screen print:bg-white print:p-0 print:m-0 print:min-h-0">
      <style>{'@media print { @page { size: portrait; } }'}</style>
      {/* --- TOP TOOLBAR (Hidden when printing) --- */}
      <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <Button variant="outline" onClick={() => router.push('/admin/quotations')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
        </Button>

        <div className="flex gap-2 items-center">
          <span className="text-sm text-slate-500 italic hidden md:inline">Review details. Click Print when ready.</span>
          <div className="flex gap-2 bg-white p-1 rounded-lg border shadow-sm">
            {/* EDIT BUTTON */}
            <Link href={`/admin/quotations/${params.id}/edit`}>
              <Button variant="ghost" size="sm">
                <Pencil className="mr-2 h-4 w-4" /> Edit Quote
              </Button>
            </Link>

            {/* PRINT BUTTON */}
            <Button 
              type="button"
              onClick={() => window.print()} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md print:hidden"
              size="sm"
            >
              <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      {/* --- PREVIEW AREA (The "Hardcopy") --- */}
      <div className="quote-container-wrapper pb-20 print:pb-0">
        <div
          className="bg-white p-10 border shadow-lg print:shadow-none print:border-none print:m-0 print:p-0 min-h-[29.7cm] print:min-h-0 mx-auto max-w-5xl text-slate-900 flex flex-col print:block print:h-auto"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {/* HEADER */}
          <div className="flex justify-between items-start mb-4">
            <div className="text-sm leading-tight font-bold">
              <h1 className="text-lg font-bold mb-1 text-slate-900">Altek Green</h1>
              <p className="text-[10px] text-slate-500 font-bold mb-1">Vendor Number: 11055342</p>
              <div className="font-normal text-xs text-slate-800 space-y-0.5">
                <p>Unit 6 Astro Place</p>
                <p>163 Van der Bijl Road, Meadowdale</p>
                <p>Gauteng 1609 ZAF</p>
                <p>+27875512620</p>
                <p>sales@altekgreen.com</p>
                <p>www.altekgreen.com</p>
                <p>VAT Registration No. 4660304447</p>
              </div>
            </div>
            <div className="w-64 flex justify-end">
              <Image src="/Altek-Logo.jpeg" width={200} height={100} alt="Altek Green" className="object-contain" />
            </div>
          </div>

          {/* TITLE */}
          <h2 className="text-2xl text-slate-500 font-normal mb-4">Quote</h2>
          
          {/* METADATA */}
          <div className="flex justify-between items-start mb-4">
            <div className="w-1/2">
              <label className="text-xs text-slate-400 uppercase font-bold block mb-1">ADDRESS</label>
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-900 font-medium">{quote.clientAddress}</div>
            </div>
            <div className="w-1/3 text-right text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-slate-400 uppercase font-bold text-right">QUOTE</span>
                <span className="font-bold text-slate-900 text-right">{quote.quoteNumber}</span>
                <span className="text-slate-400 uppercase font-bold text-right">DATE</span>
                <span className="font-bold text-slate-900 text-right">{quote.date}</span>
              </div>
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div className="mb-8 flex-grow print:flex-none print:mb-4">
            <Table>
              <TableHeader className="bg-slate-200">
                <TableRow className="border-none">
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[10%] pl-2">DATE</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[15%]">SERVICE MASTER #</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[35%]">DESCRIPTION</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[8%]">TAX</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[8%] text-right">QTY</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[12%] text-right">RATE</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase w-[12%] text-right pr-2">AMOUNT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items?.map((item: any, idx: number) => (
                  <TableRow key={idx} className="border-b border-dashed border-slate-200 hover:bg-transparent">
                    <TableCell className="align-top py-2 pl-2 text-sm">{item.date}</TableCell>
                    <TableCell className="align-top py-2 text-sm font-bold text-red-600">{item.serviceMasterNumber || 'N/A'}</TableCell>
                    <TableCell className="align-top py-2 text-sm whitespace-pre-wrap">{item.description}</TableCell>
                    <TableCell className="align-top py-2 text-sm">{item.taxType}</TableCell>
                    <TableCell className="align-top py-2 text-right text-sm">{item.qty}</TableCell>
                    <TableCell className="align-top py-2 text-right text-sm">
                      {item.rate?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="align-top py-2 text-right text-sm font-bold pr-2">
                      {(item.qty * item.rate)?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* TOTALS */}
          <div className="flex justify-end mb-12 print:mb-6 print:break-inside-avoid">
            <div className="w-1/3">
              <div className="flex justify-between py-1 text-slate-500 text-sm">
                <span>SUBTOTAL</span>
                <span>{quote.subtotal?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-500 text-sm">
                <span>TAX</span>
                <span>{quote.taxTotal?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-2 mt-2 border-t border-slate-100">
                <span className="text-slate-400 font-bold text-sm uppercase">TOTAL</span>
                <span className="text-xl font-bold text-slate-900">
                  ZAR {quote.total?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* TAX SUMMARY */}
          <div className="mb-12 print:mb-6 print:break-inside-avoid">
            <h3 className="text-xs text-slate-500 font-bold uppercase mb-2">TAX SUMMARY</h3>
            <Table className="w-full">
              <TableHeader className="bg-slate-100">
                <TableRow className="border-none">
                  <TableHead className="text-slate-500 font-bold text-xs uppercase text-right w-[33%]">RATE</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase text-right w-[33%] TAX">TAX</TableHead>
                  <TableHead className="text-slate-500 font-bold text-xs uppercase text-right w-[33%] pr-4">NET</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-none">
                  <TableCell className="text-right text-sm">VAT @ 15%</TableCell>
                  <TableCell className="text-right text-sm">
                    {quote.taxTotal?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-sm pr-4">
                    {quote.subtotal?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* FOOTER */}
          <div className="text-sm text-slate-400 mt-auto pt-8 border-t border-slate-50 print:mt-4 print:break-inside-avoid">
            <div className="grid grid-cols-2 gap-12">
              <div className="space-y-4">
                <p className="text-slate-900 font-bold">Accepted By</p>
                <div className="border-b border-slate-200 w-full h-8"></div>
              </div>
              <div className="space-y-4">
                <p className="text-slate-900 font-bold">Accepted Date</p>
                <div className="border-b border-slate-200 w-full h-8"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
