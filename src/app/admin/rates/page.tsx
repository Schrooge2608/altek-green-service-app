
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Database, Loader2, DollarSign, Pencil, Save, X } from 'lucide-react';
import { useCollection, useFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';

// ------------------------------------------------------------------
// 1. HARDCODED RATES FROM ALTEK PRICE LIST
// ------------------------------------------------------------------
const ALTEK_RATES = [
  { serviceMasterNumber: '3087513', description: 'Labour, Service Engineer/Technologist normal time (NT)', unit: 'HR', rate: 747.63, taxType: 'Standard' },
  { serviceMasterNumber: '3087513', description: 'Labour, Service Engineer/Technologist over time (OT)', unit: 'HR', rate: 1121.45, taxType: 'Standard' },
  { serviceMasterNumber: '3087513', description: 'Labour, Service Engineer/Technologist double time (DT)', unit: 'HR', rate: 1495.26, taxType: 'Standard' },
  { serviceMasterNumber: '3087513', description: 'Labour, Service Technician normal time (NT)', unit: 'HR', rate: 663.97, taxType: 'Standard' },
  { serviceMasterNumber: '3087513', description: 'Labour, Service Technician over time (OT)', unit: 'HR', rate: 995.96, taxType: 'Standard' },
  { serviceMasterNumber: '3087513', description: 'Labour, Service Technician double time (DT)', unit: 'HR', rate: 1327.94, taxType: 'Standard' },
  { serviceMasterNumber: '3087513', description: 'Labour, Service Semi-Skilled Assistant', unit: 'HR', rate: 387.32, taxType: 'Standard' },
];

export default function ServiceRatesPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  // Fetch user role for permissions
  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);
  
  const isAdmin = useMemo(() => {
    if (!user) return false;
    return userData?.role === 'Admin' || userData?.role === 'Superadmin' || user.email === 'admin@altekgreen.com';
  }, [user, userData]);

  // Fetch existing rates
  const ratesQuery = useMemoFirebase(
    () => query(collection(firestore, 'service_rates'), orderBy('description', 'asc')),
    [firestore]
  );
  const { data: rates, isLoading } = useCollection(ratesQuery);

  // New Rate State
  const [newServiceMaster, setNewServiceMaster] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newUnit, setNewUnit] = useState('HR');
  const [newRate, setNewRate] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  // Edit Row State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editServiceMaster, setEditServiceMaster] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editRate, setEditRate] = useState('');

  const startEditing = (rate: any) => {
    setEditingId(rate.id);
    setEditServiceMaster(rate.serviceMasterNumber || '');
    setEditDesc(rate.description || '');
    setEditUnit(rate.unit || '');
    setEditRate(rate.rate.toString());
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id: string) => {
    if (!editDesc || !editRate) {
      toast({ variant: 'destructive', title: 'Error', description: 'Description and Rate are required.' });
      return;
    }
    
    updateDocumentNonBlocking(doc(firestore, 'service_rates', id), {
      serviceMasterNumber: editServiceMaster,
      description: editDesc,
      unit: editUnit,
      rate: parseFloat(editRate),
    });
    
    setEditingId(null);
    toast({ title: 'Rate Updated', description: 'The service rate has been updated.' });
  };

  // ADD SINGLE RATE MANUALLY
  const handleAdd = async () => {
    if (!newDesc || !newRate) {
      toast({ variant: 'destructive', title: 'Error', description: 'Description and Rate are required.' });
      return;
    }
    
    addDocumentNonBlocking(collection(firestore, 'service_rates'), {
      serviceMasterNumber: newServiceMaster,
      description: newDesc,
      unit: newUnit,
      rate: parseFloat(newRate),
      taxType: 'Standard'
    });
    
    setNewServiceMaster('');
    setNewDesc('');
    setNewRate('');
    toast({ title: 'Rate Added', description: 'New service rate has been added.' });
  };

  // DELETE RATE
  const handleDelete = async (id: string) => {
    if (!id) return;
    if (confirm('Are you sure you want to delete this rate?')) {
      deleteDocumentNonBlocking(doc(firestore, 'service_rates', id));
      toast({ title: 'Rate Deleted', description: 'The rate has been removed.' });
    }
  };

  // BULK LOAD ALTEK RATES
  const handleLoadDefaults = async () => {
    if (!confirm('Load Altek Green default rates?')) return;
    
    setIsSeeding(true);
    try {
      const colRef = collection(firestore, 'service_rates');
      for (const item of ALTEK_RATES) {
        await addDocumentNonBlocking(colRef, item);
      }
      toast({ title: "Rates Loaded", description: `${ALTEK_RATES.length} standard rates added.` });
    } catch (error: any) {
      console.error("SEEDING ERROR:", error);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
    setIsSeeding(false);
  };

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Service Rates</h1>
          <p className="text-muted-foreground">Manage the official Altek Green price list for labor and travel.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleLoadDefaults} 
          disabled={isSeeding || !isAdmin}
          className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        >
          {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
          Load Altek Rates
        </Button>
      </header>

      {/* ADD NEW RATE CARD */}
      <Card className="bg-slate-50 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Add Custom Rate</CardTitle>
          <CardDescription>Enter a new item into the price list.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4 items-end">
          <div className="grid gap-2 w-full md:w-48">
            <label className="text-xs font-bold uppercase text-slate-500">Service Master #</label>
            <Input 
              placeholder="e.g. 3087513" 
              value={newServiceMaster} 
              onChange={e => setNewServiceMaster(e.target.value)} 
              className="bg-white font-mono"
              disabled={!isAdmin}
            />
          </div>
          <div className="grid gap-2 w-full flex-grow">
            <label className="text-xs font-bold uppercase text-slate-500">Description</label>
            <Input 
              placeholder="e.g. Specialized Travel per km" 
              value={newDesc} 
              onChange={e => setNewDesc(e.target.value)} 
              className="bg-white"
              disabled={!isAdmin}
            />
          </div>
          <div className="grid gap-2 w-full md:w-32">
            <label className="text-xs font-bold uppercase text-slate-500">Unit</label>
            <Input 
              placeholder="HR / KM" 
              value={newUnit} 
              onChange={e => setNewUnit(e.target.value)} 
              className="bg-white"
              disabled={!isAdmin}
            />
          </div>
          <div className="grid gap-2 w-full md:w-48">
            <label className="text-xs font-bold uppercase text-slate-500">Rate (ZAR)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">R</span>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={newRate} 
                onChange={e => setNewRate(e.target.value)} 
                className="bg-white pl-7"
                disabled={!isAdmin}
              />
            </div>
          </div>
          <Button onClick={handleAdd} className="w-full md:w-auto bg-primary" disabled={!isAdmin}>
            <Plus className="mr-2 h-4 w-4" /> Add Rate
          </Button>
        </CardContent>
      </Card>

      {/* RATES TABLE */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Master Price List</CardTitle>
            <CardDescription>Current billing rates (Excl. VAT).</CardDescription>
          </div>
          <DollarSign className="h-5 w-5 text-muted-foreground opacity-50" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Master #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Rate (Excl VAT)</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : rates?.map((rate: any) => (
                <TableRow key={rate.id} className="hover:bg-slate-50/50">
                  <TableCell className="font-mono text-sm text-slate-500">
                    {editingId === rate.id ? (
                      <Input value={editServiceMaster} onChange={e => setEditServiceMaster(e.target.value)} className="h-8 font-mono" />
                    ) : (
                      rate.serviceMasterNumber || <span className="italic opacity-30">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {editingId === rate.id ? (
                      <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="h-8" />
                    ) : (
                      rate.description
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === rate.id ? (
                      <Input value={editUnit} onChange={e => setEditUnit(e.target.value)} className="h-8 w-20" />
                    ) : (
                      <Badge variant="outline" className="font-mono">{rate.unit}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-slate-700">
                    {editingId === rate.id ? (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">R</span>
                        <Input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} className="h-8 pl-6 text-right w-32" />
                      </div>
                    ) : (
                      `R ${rate.rate.toFixed(2)}`
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdmin && (
                      <div className="flex items-center gap-1 justify-end">
                        {editingId === rate.id ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleUpdate(rate.id)} className="text-emerald-600 hover:bg-emerald-50">
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={cancelEditing} className="text-slate-400 hover:bg-slate-100">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => startEditing(rate)} className="text-slate-400 hover:text-primary">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(rate.id)}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!rates || rates.length === 0) && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Database className="h-8 w-8 opacity-20" />
                      <p>No rates found. Click "Load Altek Rates" to populate the list.</p>
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
