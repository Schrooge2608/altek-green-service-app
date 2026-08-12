'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

export default function CharPlantTopMCCPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  // Query equipment specifically for this MCC
  const equipmentQuery = useMemoFirebase(
    () => query(collection(firestore, 'equipment'), where('mcc', '==', 'Charplant Top MCC / E4')),
    [firestore]
  );
  
  const { data: equipmentList, isLoading } = useCollection<Equipment>(equipmentQuery);

  const handleSeedData = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    
    const items = [
      { name: "Travelling Grate", type: "VSD", manufacturer: "Control Techniques", model: "UNI SP" },
      { name: "Travelling Grate (2)", type: "VSD", manufacturer: "Control Techniques", model: "UNI SP" }, // Differentiated name slightly to avoid duplicate names
    ];

    try {
      for (const item of items) {
        const eqId = generateUUID();
        const vsdId = generateUUID();

        // 1. Create the VSD/Soft Starter document
        await setDoc(doc(collection(firestore, 'vsds'), vsdId), {
          id: vsdId,
          driveType: item.type === 'VSD' || item.type === 'Soft Starter' ? item.type : 'VSD',
          serialNumber: 'Pending',
          equipmentId: eqId,
          model: item.model,
          manufacturer: item.manufacturer,
          installationDate: new Date().toISOString().split('T')[0],
          status: 'active',
          assignedToName: ''
        });

        // 2. Create the Equipment document
        const eqData: any = {
          id: eqId,
          name: item.name,
          location: 'Smelter',
          plant: 'Smelter',
          division: 'Char Plant',
          mcc: 'Charplant Top MCC / E4', 
          vsdId: vsdId,
          assignedToName: '',
          breakdownStatus: 'None',
          status: 'active'
        };

        await setDoc(doc(collection(firestore, 'equipment'), eqId), eqData);
      }

      toast({ title: "Success", description: "Charplant Top MCC / E4 equipment list has been populated." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to seed data." });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDelete = async (eqId: string, vsdId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'equipment', eqId));
      if (vsdId) {
        await deleteDoc(doc(firestore, 'vsds', vsdId));
      }
      toast({ title: "Deleted", description: "Equipment removed." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete." });
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/smelter-v2/char-plant">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Charplant Top MCC / E4</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <MapPin className="h-3 w-3 text-primary" />
              Smelter • Char Plant
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">MCC Online</span>
          </div>
          {!isLoading && (!equipmentList || equipmentList.length === 0) && (
            <Button 
                variant="outline" 
                onClick={handleSeedData} 
                disabled={isSeeding}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
                {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                Seed Dictated List
            </Button>
          )}
          <Link href={`/equipment/new?mcc=Charplant Top MCC / E4&plant=Smelter&division=Char Plant&location=Smelter`}>
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
            Connected Equipment & Drives
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Manage all variable speed drives, motors, and protection systems powered by Charplant Top MCC / E4.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
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
                              <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(eq.id, eq.vsdId || '')}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </TableCell>
                      </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Settings2 className="h-8 w-8 opacity-20" />
                      <p className="text-sm font-medium">Ready for Equipment</p>
                      <p className="text-xs max-w-sm">
                        Click "Seed Dictated List" above to populate the equipment from the spreadsheet.
                      </p>
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
