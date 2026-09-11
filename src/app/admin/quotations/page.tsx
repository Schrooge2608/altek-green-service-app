'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Plus, Loader2, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

export default function QuotationTrackerPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);

  // Fetch quotes ordered by newest first
  const quotesQuery = useMemoFirebase(
    () => query(collection(firestore, 'quotations'), orderBy('quoteNumber', 'desc')),
    [firestore]
  );
  const { data: quotes, isLoading } = useCollection(quotesQuery);

  const canCreate = userData?.role && (
    userData.role.includes('Admin') || 
    userData.role.includes('Superadmin') || 
    userData.role.includes('Corporate Manager') || 
    userData.role.includes('Services Manager')
  );

  // Group quotes by month (YYYY-MM)
  const groupedQuotes = useMemo(() => {
    if (!quotes) return {};
    return quotes.reduce((acc: Record<string, any[]>, quote: any) => {
      const dateStr = quote.date || ''; // e.g. "2024-09-10"
      let monthKey = 'Unknown Date';
      let sortKey = '0000-00';
      if (dateStr.length >= 7) {
        const yyyy = dateStr.substring(0, 4);
        const mm = dateStr.substring(5, 7);
        sortKey = `${yyyy}-${mm}`;
        const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1);
        if (!isNaN(dateObj.getTime())) {
          monthKey = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        }
      }
      
      const key = `${sortKey}|${monthKey}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(quote);
      return acc;
    }, {});
  }, [quotes]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const monthKey = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return `${yyyy}-${mm}|${monthKey}`;
  }, []);

  // Get sorted group keys (newest month first)
  const groupKeys = Object.keys(groupedQuotes).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Quotation Tracker</h1>
          <p className="text-muted-foreground">Manage and track all generated client quotes.</p>
        </div>
        {canCreate && (
          <Link href="/admin/quotations/create" passHref>
            <Button className="bg-primary">
              <Plus className="mr-2 h-4 w-4" />
              Create New Quote
            </Button>
          </Link>
        )}
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-2">Loading Quotes...</p>
        </div>
      ) : Object.keys(groupedQuotes).length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="text-center py-20 text-slate-400">
              No quotes found yet. Click "Create New Quote" to start.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Accordion 
          type="multiple" 
          defaultValue={[currentMonthKey]}
          className="w-full space-y-4"
        >
          {groupKeys.map((key) => {
            const [sortKey, displayName] = key.split('|');
            const groupQuotes = groupedQuotes[key];
            const isCurrentMonth = key === currentMonthKey;

            return (
              <AccordionItem key={key} value={key} className="border bg-white rounded-lg shadow-sm overflow-hidden px-1">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-100 rounded-md text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-lg text-slate-900 flex items-center gap-3">
                        {displayName}
                        {isCurrentMonth && (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 uppercase text-[10px] font-black">
                            Current Month
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-slate-500 font-medium">
                        {groupQuotes.length} quote{groupQuotes.length === 1 ? '' : 's'} generated
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-4 px-6">
                  <div className="border rounded-md overflow-hidden mt-4">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-bold pl-6">Quote #</TableHead>
                          <TableHead className="font-bold">Date</TableHead>
                          <TableHead className="font-bold">Client</TableHead>
                          <TableHead className="text-right font-bold">Total (Inc VAT)</TableHead>
                          <TableHead className="w-[150px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupQuotes.map((quote: any) => (
                          <TableRow key={quote.id} className="hover:bg-slate-50">
                            <TableCell className="font-medium text-emerald-700 pl-6">{quote.quoteNumber}</TableCell>
                            <TableCell>{quote.date}</TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {quote.clientRef || (quote.clientAddress ? quote.clientAddress.split('\n')[0] : 'Unknown')}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-slate-700">
                              R {quote.total?.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) || '0.00'}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <Link href={`/admin/quotations/${quote.id}`}>
                                <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                                  <Eye className="mr-2 h-4 w-4" /> Preview / Print
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
