'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AltekLogo } from '@/components/altek-logo';
import { PinSigner } from '@/components/auth/PinSigner';
import { 
  ArrowLeft, 
  Printer, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileCheck,
  PackageCheck
} from 'lucide-react';
import { 
  useDoc, 
  useFirebase, 
  useMemoFirebase, 
  useUser,
  useCollection,
  updateDocumentNonBlocking
} from '@/firebase';
import { doc, collection, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import type { IPRRequest, User, Consumable } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ViewIPRPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [issuedQuantities, setIssuedQuantities] = useState<Record<string, number>>({});

  // 1. Fetch IPR Data
  const requestId = params.id as string;
  const iprRef = useMemoFirebase(() => requestId ? doc(firestore, 'ipr_requests', requestId) : null, [firestore, requestId]);
  const { data: ipr, isLoading: iprLoading } = useDoc<IPRRequest>(iprRef);

  // 2. User & Permissions
  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRef);
  const isAdmin = userData?.role && ['Admin', 'Superadmin', 'Services Manager'].includes(userData.role);

  // 3. Fetch All Users (for PIN Signer)
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<User>(usersQuery);

  // Initialize issued quantities from request items if not already set
  React.useEffect(() => {
    if (ipr && Object.keys(issuedQuantities).length === 0) {
      const initial: Record<string, number> = {};
      ipr.items.forEach((item, idx) => {
        initial[idx] = item.requestedQty;
      });
      setIssuedQuantities(initial);
    }
  }, [ipr]);

  const handleIssueAndSign = async (signatureUrl: string | null, signerName: string | null) => {
    if (!ipr || !signatureUrl || !firestore || !user) return;
    setIsProcessing(true);

    try {
      const batch = writeBatch(firestore);
      const iprDocRef = doc(firestore, 'ipr_requests', ipr.id);

      // 1. Update Inventory for each item
      for (const [idx, item] of ipr.items.entries()) {
        const issuedQty = Number.isNaN(issuedQuantities[idx]) ? 0 : (issuedQuantities[idx] || 0);
        if (issuedQty > 0) {
          const consumableRef = doc(firestore, 'consumables', item.consumableId);
          const consumableSnap = await getDoc(consumableRef);
          if (consumableSnap.exists()) {
            const currentStock = (consumableSnap.data() as Consumable).quantity;
            batch.update(consumableRef, { quantity: Math.max(0, currentStock - issuedQty) });
          }
        }
      }

      // 2. Update IPR Status and add signature
      const updatedItems = ipr.items.map((item, idx) => ({
        ...item,
        issuedQty: Number.isNaN(issuedQuantities[idx]) ? 0 : (issuedQuantities[idx] || 0)
      }));

      batch.update(iprDocRef, {
        status: 'Issued',
        items: updatedItems,
        technicianSignature: signatureUrl,
        technicianSignatureDate: format(new Date(), 'yyyy-MM-dd'),
        issuerName: userData?.name || 'Authorized Issuer',
        issuedDate: format(new Date(), 'yyyy-MM-dd'),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: "Goods Issued", description: "The IPR has been signed and stock updated." });
      router.refresh();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: "Processing Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (iprLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!ipr) return <div className="p-20 text-center">IPR Request not found.</div>;

  const isIssued = ipr.status === 'Issued';

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
      <div className="flex justify-between items-center mb-6 no-print">
        <Button variant="outline" onClick={() => router.push('/inventory/consumables/ipr')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tracker
        </Button>
        <Button variant="ghost" onClick={() => window.print()} className="text-slate-500">
          <Printer className="mr-2 h-4 w-4" /> Print Copy
        </Button>
      </div>

      <Card className="p-8 shadow-lg border-2 border-primary/10">
        {/* HEADER */}
        <div className="flex justify-between items-start mb-8 border-b pb-6">
          <div>
            <AltekLogo className="h-10 w-auto mb-2" />
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Internal Purchase Requisition (IPR)</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-slate-900">REQUISITION</h1>
            <p className="font-mono text-sm text-primary">IPR-{ipr.id.slice(-6).toUpperCase()}</p>
            <p className="text-sm text-slate-500 mt-1">{ipr.date}</p>
          </div>
        </div>

        {/* METADATA */}
        <div className="grid md:grid-cols-2 gap-8 mb-8 bg-slate-50 p-4 rounded-lg border">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-slate-400 font-bold">Requesting Technician</Label>
            <p className="font-bold text-slate-800">{ipr.userName}</p>
            <p className="text-xs text-slate-500">Employee ID: {ipr.userId.slice(-4).toUpperCase()}</p>
          </div>
          <div className="text-right space-y-1">
            <Label className="text-[10px] uppercase text-slate-400 font-bold">Status</Label>
            <div>
              {isIssued ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> COMPLETED / ISSUED
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 animate-pulse">
                  <AlertCircle className="mr-1 h-3 w-3" /> PENDING ISSUANCE
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="mb-12">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead className="w-[10%] text-center">QTY REQ</TableHead>
                <TableHead className="w-[50%]">DESCRIPTION OF GOODS</TableHead>
                <TableHead className="w-[20%] text-center">QTY ISSUED</TableHead>
                <TableHead className="w-[20%] text-right pr-4">UNIT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ipr.items.map((item, idx) => (
                <TableRow key={idx} className="border-b border-dashed">
                  <TableCell className="text-center font-bold text-slate-600">{item.requestedQty}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-center">
                    {isIssued ? (
                      <span className="font-bold text-emerald-700">{item.issuedQty}</span>
                    ) : isAdmin ? (
                      <Input 
                        type="number" 
                        className="w-20 mx-auto text-center font-bold border-emerald-300 bg-emerald-50" 
                        value={Number.isNaN(issuedQuantities[idx]) ? "" : (issuedQuantities[idx] ?? 0)}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setIssuedQuantities({...issuedQuantities, [idx]: val});
                        }}
                      />
                    ) : (
                      <span className="text-slate-300 italic">Pending...</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-4 text-xs text-slate-400 uppercase font-medium">Consumable Item</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* SIGNATURES */}
        <div className="grid md:grid-cols-2 gap-12 mt-12 border-t pt-8">
          {/* ISSUER */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider">Authorized Issuer</h3>
            <div className="border-b-2 border-slate-200 pb-2">
              {isIssued ? (
                <div className="space-y-1">
                  <p className="font-bold text-slate-800">{ipr.issuerName}</p>
                  <p className="text-[10px] text-slate-400">Date Issued: {ipr.issuedDate}</p>
                </div>
              ) : (
                <p className="text-slate-300 italic py-4">Required on hand-over...</p>
              )}
            </div>
            <p className="text-[10px] text-slate-400">Goods released from site stores.</p>
          </div>

          {/* TECHNICIAN RECEIPT */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase text-slate-400 tracking-wider">Receiver (Technician Acknowledgement)</h3>
            
            {ipr.technicianSignature ? (
              <div className="space-y-2">
                <img src={ipr.technicianSignature} alt="Tech Sig" className="h-16 object-contain border-b border-slate-100" />
                <p className="text-xs font-bold text-slate-700">Digitally Signed by {ipr.userName}</p>
                <p className="text-[10px] text-slate-400">Receipt Date: {ipr.technicianSignatureDate}</p>
              </div>
            ) : isAdmin ? (
              <div className="bg-emerald-50 p-4 rounded-md border border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium mb-4 flex items-center gap-2">
                  <PackageCheck className="h-4 w-4" /> Ready to Issue? Ask Technician to enter PIN below.
                </p>
                <PinSigner 
                  label="Technician Sign Receipt" 
                  users={allUsers || []} 
                  onSigned={handleIssueAndSign}
                  disabled={isProcessing}
                />
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 rounded border-2 border-dashed border-slate-200">
                <p className="text-xs text-slate-400 italic">Technician signature required upon receipt of goods.</p>
              </div>
            )}
            
            <p className="text-[10px] text-slate-400 leading-tight">
              I acknowledge that I have received the above items in good order and that they are for official use only.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-16 text-center text-[10px] text-slate-300 uppercase tracking-[0.2em]">
          Altek Green - Site Logistics & Maintenance Tracker
        </div>
      </Card>
    </div>
  );
}