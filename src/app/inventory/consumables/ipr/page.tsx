
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Loader2, 
  ArrowLeft, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Eye,
  UserCheck
} from 'lucide-react';
import { 
  useCollection, 
  useFirebase, 
  useMemoFirebase, 
  useUser,
  useDoc
} from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { IPRRequest, User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function IPRTrackerPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();

  // 1. Fetch IPRs
  const iprQuery = useMemoFirebase(
    () => query(collection(firestore, 'ipr_requests'), orderBy('date', 'desc')),
    [firestore]
  );
  const { data: requests, isLoading } = useCollection<IPRRequest>(iprQuery);

  // 2. Permissions
  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRef);
  const isAdmin = userData?.role && ['Admin', 'Superadmin', 'Services Manager'].includes(userData.role);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Issued': return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Issued</Badge>;
      case 'Pending': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
      case 'Cancelled': return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 bg-background">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/inventory/consumables')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">IPR Tracker</h1>
            <p className="text-muted-foreground">Internal Purchase Requisitions for consumables.</p>
          </div>
        </div>
        <Link href="/inventory/consumables/order">
          <Button className="bg-primary">
            <Plus className="mr-2 h-4 w-4" /> New IPR Request
          </Button>
        </Link>
      </header>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-lg">Requisition History</CardTitle>
          <CardDescription>Track the status of goods issued to technicians.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Request ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : requests && requests.length > 0 ? (
                requests.map(req => (
                  <TableRow key={req.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-mono text-xs pl-6">IPR-{req.id.slice(-6).toUpperCase()}</TableCell>
                    <TableCell className="text-sm">{req.date}</TableCell>
                    <TableCell className="font-medium text-slate-700">{req.userName}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {req.items.length} item(s) (e.g. {req.items[0].name})
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="text-right pr-6">
                      <Link href={`/inventory/consumables/ipr/${req.id}`}>
                        <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                          {req.status === 'Pending' && isAdmin ? <><UserCheck className="mr-2 h-4 w-4" /> Issue Goods</> : <><Eye className="mr-2 h-4 w-4" /> View Details</>}
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">
                    No requisition requests found.
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
