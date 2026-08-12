'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  Settings2,
  MapPin,
  ShieldCheck,
  PlusCircle,
  Database,
  Trash2,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { generateUUID } from '@/lib/utils';

export default function MPDSurgeBinMCCPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  // Query equipment specifically for this MCC
  const equipmentQuery = useMemoFirebase(
    () => query(collection(firestore, 'equipment'), where('mcc', '==', 'MPD Surge Bin MCC')),
    [firestore]
  );
  
  const { data: equipmentList, isLoading } = useCollection<Equipment>(equipmentQuery);

  // Temporary function to seed the exact list you dictated
  const handleSeedData = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    
    const items = [
      { name: "D1 Primary Feed Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "D1 Mags Feed Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "D1 Cleaner Tails Scavenger Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "D1 Final Tails Transfer Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "D1 Cleaner Mids Transfer Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "D2 Primary Feed Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "D2 Cleaner Tails Scavenger Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "D2 Mags Feed Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "D2 Cleaner Mids Transfer Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "D2 Final Tails Transfer Pump", model: "ACS880", manufacturer: "ABB", assigned: "Ntokozo" },
      { name: "Decanting Pump", model: "ACS800", manufacturer: "ABB", assigned: "Ntokozo" },
    ];

    try {
      for (const item of items) {
        const eqId = generateUUID();
        const vsdId = generateUUID();

        // 1. Create the VSD document
        await setDoc(doc(collection(firestore, 'vsds'), vsdId), {
          id: vsdId,
          driveType: 'VSD',
          serialNumber: 'Pending',
          equipmentId: eqId,
          model: item.model,
          manufacturer: item.manufacturer,
          installationDate: new Date().toISOString().split('T')[0],
          status: 'active',
          assignedToName: item.assigned
        });

        // 2. Create the Equipment document
        await setDoc(doc(collection(firestore, 'equipment'), eqId), {
          id: eqId,
          name: item.name,
          location: 'MPD',
          plant: 'Mining',
          division: 'Surge Bin',
          mcc: 'MPD Surge Bin MCC', // New hierarchical field
          vsdId: vsdId,
          assignedToName: item.assigned,
          breakdownStatus: 'None',
          status: 'active'
        });
      }

      // Seed UPS/BTU explicitly
      const upsId = generateUUID();
      await setDoc(doc(collection(firestore, 'equipment'), upsId), {
        id: upsId,
        name: 'MPD Surge Bin UPS 1',
        location: 'MPD',
        plant: 'Mining',
        division: 'Surge Bin',
        mcc: 'MPD Surge Bin MCC',
        assignedToName: 'Unassigned',
        breakdownStatus: 'Operational',
        status: 'active',
        upsType: 'Industrial UPS',
        batteryType: 'Lead Acid',
        batteryQuantity: 10,
        batteryExpiryDate: '2027-01-01',
        lastBatteryReplacement: '2024-01-01',
        upsSerialNumber: 'Pending'
      });

      const btuId = generateUUID();
      await setDoc(doc(collection(firestore, 'equipment'), btuId), {
        id: btuId,
        name: 'MPD Surge Bin BTU 1',
        location: 'MPD',
        plant: 'Mining',
        division: 'Surge Bin',
        mcc: 'MPD Surge Bin MCC',
        assignedToName: 'Unassigned',
        breakdownStatus: 'Operational',
        status: 'active',
        upsType: 'BTU Unit',
        batteryType: 'N/A',
        batteryQuantity: 0,
        batteryExpiryDate: 'N/A',
        lastBatteryReplacement: 'N/A',
        upsSerialNumber: 'Pending'
      });

      toast({ title: "Seed Successful", description: "Equipment added." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDelete = async (eqId: string, vsdId?: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'equipment', eqId));
      if (vsdId) await deleteDoc(doc(firestore, 'vsds', vsdId));
      toast({ title: "Deleted", description: "Equipment removed." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete." });
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/mining/ponds/mpd/surge-bin">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">MPD SURGE BIN MCC</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary" />
              MPD • Surge Bin • Equipment List
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {(!equipmentList || equipmentList.length === 0 || !equipmentList.some(eq => !eq.name?.includes('UPS') && !eq.name?.includes('BTU'))) && (
            <Button 
              onClick={handleSeedData}
              disabled={isSeeding}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[10px] tracking-[0.2em]"
            >
              {isSeeding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              {isSeeding ? 'Seeding...' : 'Seed Dictated List'}
            </Button>
          )}
          <Link href={`/equipment/new?mcc=MPD Surge Bin MCC&plant=Mining&division=Surge Bin&location=MPD`}>
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold uppercase text-[10px] tracking-[0.2em]">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Equipment
            </Button>
          </Link>
        </div>
      </header>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-800 uppercase tracking-tight">
            <Settings2 className="h-5 w-5 text-slate-500" />
            Connected Equipment & VSDs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold uppercase text-xs tracking-wider text-slate-500">Equipment Name</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider text-slate-500">Location</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider text-slate-500">Assigned To</TableHead>
                <TableHead className="font-bold uppercase text-xs tracking-wider text-slate-500">Status</TableHead>
                <TableHead className="text-right font-bold uppercase text-xs tracking-wider text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></TableCell>
                  </TableRow>
              ) : equipmentList && equipmentList.length > 0 ? (
                  [...equipmentList].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })).map(eq => (
                      <TableRow key={eq.id}>
                          <TableCell className="font-semibold text-slate-800">
                            <Link href={`/equipment/${eq.id}`} className="hover:underline text-primary">
                              {eq.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{eq.mcc}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{eq.assignedToName || 'Unassigned'}</TableCell>
                          <TableCell>
                              <Badge variant={eq.breakdownStatus === 'Active' ? 'destructive' : 'default'} className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none">
                                  {eq.breakdownStatus || 'Operational'}
                              </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(eq.id, eq.vsdId)}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </TableCell>
                      </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <Settings2 className="h-12 w-12 text-slate-200 mb-4" />
                      <p className="font-semibold text-lg text-slate-700">No equipment found</p>
                      <p className="text-sm">This MCC currently has no connected equipment.</p>
                      <p className="text-sm mt-2 font-medium text-slate-600">Click &quot;Seed Dictated List&quot; above to auto-populate.</p>
                    </div>
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
