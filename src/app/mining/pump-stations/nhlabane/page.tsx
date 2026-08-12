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
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Equipment, User as AppUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { generateUUID } from '@/lib/utils';

export default function NhlabaneMCCPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const { user } = useUser();
  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<AppUser>(userRoleRef);
  const isAdmin = userData?.role && (userData.role.includes('Admin') || userData.role.includes('Manager') || userData.role === 'Admin' || userData.role === 'System Admin');
  const [isSeeding, setIsSeeding] = useState(false);

  // Query equipment specifically for this MCC
  const equipmentQuery = useMemoFirebase(
    () => query(collection(firestore, 'equipment'), where('mcc', '==', 'Nhlabane MCC')),
    [firestore]
  );
  
  const { data: equipmentList, isLoading } = useCollection<Equipment>(equipmentQuery);

  const handleSeedData = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    
    const items = [
      { name: "Pump No.1", brand: "ABB", model: "ABB ACS 880", assigned: "Ntokozo" },
      { name: "Pump No 2", brand: "ABB", model: "ABB ACS 880", assigned: "Ntokozo" },
      { name: "Pump No.3", brand: "ABB", model: "ABB ACS 880", assigned: "Ntokozo" },
      { name: "Pump No.4", brand: "ABB", model: "ABB ACS 880", assigned: "Ntokozo" },
      { name: "Pump No.5", brand: "ABB", model: "ABB ACS 880", assigned: "Ntokozo" },
      { name: "Pump No.6", brand: "ABB", model: "ABB ACS 880", assigned: "Ntokozo" },
      { name: "Pump No.7", brand: "ABB", model: "ABB ACS880", assigned: "Ntokozo" },
      { name: "Pump No.8", brand: "ABB", model: "ABB ACS880", assigned: "Ntokozo" },
      { name: "Nhlabane UPS", brand: "Eaton", model: "9SX", assigned: "Ntokozo", category: "UPS" },
      { name: "Nhlabane Cooling Unit", brand: "Daikin", model: "Split Type", assigned: "Ntokozo", category: "BTU" },
    ];

    try {
      const batchPromises = items.map(async (item) => {
        const eqId = generateUUID();
        
        if (item.category === 'UPS' || item.category === 'BTU') {
          return setDoc(doc(firestore, 'equipment', eqId), {
            id: eqId,
            name: item.name,
            location: 'Nhlabane',
            plant: 'Mining',
            division: 'Pump Stations',
            mcc: 'Nhlabane MCC',
            upsType: item.category,
            upsBrand: item.brand,
            upsModel: item.model,
            status: 'active',
            assignedToName: item.assigned
          });
        }

        const vsdId = generateUUID();
        await setDoc(doc(collection(firestore, 'vsds'), vsdId), {
          id: vsdId,
          driveType: 'Soft Starter',
          serialNumber: 'Pending',
          equipmentId: eqId,
          model: item.model,
          manufacturer: item.brand,
          installationDate: new Date().toISOString().split('T')[0],
          status: 'active',
          assignedToName: item.assigned
        });

        return setDoc(doc(firestore, 'equipment', eqId), {
          id: eqId,
          name: item.name,
          location: 'Nhlabane',
          plant: 'Mining',
          division: 'Pump Stations',
          mcc: 'Nhlabane MCC',
          vsdId: vsdId,
          assignedToName: item.assigned,
          breakdownStatus: 'None',
          status: 'active'
        });
      });

      await Promise.all(batchPromises);
      toast({
        title: "Seed Successful",
        description: "Nhlabane pumps have been added to the database.",
      });
    } catch (error) {
      console.error("Error seeding data:", error);
      toast({
        title: "Seed Failed",
        description: "Failed to add equipment.",
        variant: "destructive"
      });
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

  const handleClearData = async () => {
    if (!firestore || !equipmentList) return;
    
    if (confirm("Are you sure you want to delete all equipment in this MCC?")) {
      try {
        const promises = equipmentList.map(item => 
          deleteDoc(doc(firestore, 'equipment', item.id))
        );
        await Promise.all(promises);
        toast({
          title: "Clear Successful",
          description: "All Nhlabane MCC equipment has been deleted.",
        });
      } catch (error) {
        console.error("Error clearing data:", error);
        toast({
          title: "Clear Failed",
          description: "Failed to delete equipment.",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/mining/pump-stations">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">NHLABANE MCC</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <Settings2 className="h-3 w-3 text-primary" />
              Pump Control Center • Equipment List
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           {isAdmin && (
            <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearData}
            disabled={!equipmentList || equipmentList.length === 0}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
          )}
          {(!equipmentList || equipmentList.length === 0) && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSeedData}
              disabled={isSeeding}
              className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
            >
              {isSeeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
              Seed Data
            </Button>
          )}
          <Link href={`/equipment/new?mcc=Nhlabane MCC&plant=Mining&division=Pump Stations&location=Nhlabane`}>
            <Button size="sm" className="bg-slate-900 hover:bg-primary text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </Link>
        </div>
      </header>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 border-b">
              <TableRow>
                <TableHead className="pl-6 font-bold text-slate-900">Equipment</TableHead>
                <TableHead className="font-bold text-slate-900">Specs</TableHead>
                <TableHead className="font-bold text-slate-900">Status</TableHead>
                <TableHead className="font-bold text-slate-900">Assigned</TableHead>
                <TableHead className="text-right font-bold uppercase text-xs tracking-wider text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" />
                  </TableCell>
                </TableRow>
              ) : equipmentList && equipmentList.length > 0 ? (
                equipmentList.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex flex-col">
                        <Link href={`/equipment/${item.id}`} className="font-bold text-primary hover:underline">{item.name}</Link>
                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{item.category || 'VSD'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700">{item.brand || 'ABB'}</span>
                        <span className="text-xs text-slate-500 font-mono">{item.model}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                        {item.assignedTechnician || 'Unassigned'}
                      </Badge>
                    </TableCell>

                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Database className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="font-medium">No equipment found.</p>
                      <p className="text-xs text-slate-400 mt-1">Use the Seed Data button to populate standard pumps.</p>
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
