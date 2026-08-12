'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, 
  Trash2, 
  Save, 
  ArrowLeft, 
  Loader2, 
  ShoppingCart,
  Package
} from 'lucide-react';
import { 
  useCollection, 
  useFirebase, 
  useMemoFirebase, 
  useUser,
  addDocumentNonBlocking
} from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Consumable, IPRRequest, IPRItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function CreateIPRPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemIdFromUrl = searchParams.get('itemId');
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ consumableId: string; name: string; qty: number }[]>([]);

  // 1. Fetch Consumables for selection
  const consumablesQuery = useMemoFirebase(
    () => query(collection(firestore, 'consumables'), orderBy('name', 'asc')),
    [firestore]
  );
  const { data: consumables, isLoading: consumablesLoading } = useCollection<Consumable>(consumablesQuery);

  // 2. Pre-fill from URL if provided
  React.useEffect(() => {
    if (itemIdFromUrl && consumables && selectedItems.length === 0) {
      const match = consumables.find(c => c.id === itemIdFromUrl);
      if (match) {
        setSelectedItems([{ consumableId: match.id, name: match.name, qty: 1 }]);
      }
    }
  }, [itemIdFromUrl, consumables]);

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { consumableId: '', name: '', qty: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, consumableId: string) => {
    const match = consumables?.find(c => c.id === consumableId);
    if (!match) return;
    
    const newItems = [...selectedItems];
    newItems[index] = { consumableId: match.id, name: match.name, qty: 1 };
    setSelectedItems(newItems);
  };

  const handleUpdateQty = (index: number, qty: number) => {
    const newItems = [...selectedItems];
    newItems[index].qty = qty; // Allows NaN in state, handled by Input value prop
    setSelectedItems(newItems);
  };

  const handleSaveIPR = async () => {
    if (!user || selectedItems.length === 0) return;
    setIsSaving(true);

    const iprItems: IPRItem[] = selectedItems
      .filter(item => item.consumableId !== "")
      .map(item => ({
        consumableId: item.consumableId,
        name: item.name,
        requestedQty: Number.isNaN(item.qty) ? 0 : item.qty,
        issuedQty: 0
      }));

    if (iprItems.length === 0) {
      toast({ variant: 'destructive', title: "Empty Order", description: "Please select at least one item." });
      setIsSaving(false);
      return;
    }

    try {
      const request: Omit<IPRRequest, 'id'> = {
        userId: user.uid,
        userName: user.displayName || user.email || 'Technician',
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pending',
        items: iprItems
      };

      await addDocumentNonBlocking(collection(firestore, 'ipr_requests'), request);
      toast({ title: "IPR Submitted", description: "Request sent to site manager for approval." });
      router.push('/inventory/consumables/ipr');
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Request Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/inventory/consumables')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">New Requisition (IPR)</h1>
            <p className="text-muted-foreground">Select consumables required for current job.</p>
          </div>
        </div>
      </header>

      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Goods Required
          </CardTitle>
          <CardDescription>Specify the quantity needed for each item.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Consumable Item</TableHead>
                <TableHead className="w-[150px]">Quantity</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedItems.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="pl-6">
                    <select 
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={item.consumableId}
                      onChange={e => handleUpdateItem(idx, e.target.value)}
                    >
                      <option value="">Select item...</option>
                      {consumables?.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.quantity} {c.unit} available)</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      min="1" 
                      value={Number.isNaN(item.qty) ? "" : item.qty} 
                      onChange={e => handleUpdateQty(idx, parseFloat(e.target.value))} 
                    />
                  </TableCell>
                  <TableCell className="pr-6">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600" onClick={() => handleRemoveItem(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-50/50">
                <TableCell colSpan={3} className="p-4">
                  <Button variant="ghost" className="w-full text-primary hover:bg-white" onClick={handleAddItem}>
                    <Plus className="mr-2 h-4 w-4" /> Add Another Item
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSaveIPR} disabled={isSaving || selectedItems.length === 0}>
          {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="mr-2 h-4 w-4" />}
          Submit Requisition
        </Button>
      </div>
    </div>
  );
}