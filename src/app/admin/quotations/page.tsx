'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Plus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { User } from '@/lib/types';

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
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
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
                {quotes && quotes.length > 0 ? (
                  quotes.map((quote: any) => (
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-32 text-slate-400">
                      No quotes found yet. Click "Create New Quote" to start.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
