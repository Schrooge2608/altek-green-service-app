'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  Loader2, 
  Trash2, 
  Package, 
  History, 
  AlertCircle,
  ScanLine,
  Check,
  X,
  FileText,
  Pencil,
  PlusSquare,
  Save
} from 'lucide-react';
import { 
  useCollection, 
  useFirebase, 
  addDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
  useMemoFirebase, 
  useUser,
  useDoc
} from '@/firebase';
import { collection, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import type { Consumable, User } from '@/lib/types';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { extractConsumablesData } from '@/ai/flows/extract-consumables-flow';
import Image from 'next/image';
import { cn } from '@/lib/utils';

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ConsumablesPage() {
  const { firestore, firebaseApp } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<any[] | null>(null);
  const [scanFilePreview, setScanFilePreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  
  // Form State for manual entry
  const [newItem, setNewItem] = useState<Partial<Consumable>>({
    name: '',
    description: '',
    quantity: 0,
    unit: 'Units',
    category: 'General'
  });

  // State for Editing
  const [editingItem, setEditingPO] = useState<Consumable | null>(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', unit: '' });

  // State for Restocking
  const [restockingItem, setRestockingItem] = useState<Consumable | null>(null);
  const [restockQty, setRestockQty] = useState<number>(0);

  // 1. Permissions
  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRef);
  const isAdmin = userData?.role && ['Admin', 'Superadmin', 'Services Manager'].includes(userData.role);

  // 2. Fetch Consumables
  const consumablesQuery = useMemoFirebase(
    () => query(collection(firestore, 'consumables'), orderBy('name', 'asc')),
    [firestore]
  );
  const { data: consumables, isLoading } = useCollection<Consumable>(consumablesQuery);

  const filteredItems = useMemo(() => {
    if (!consumables) return [];
    return consumables.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [consumables, searchTerm]);

  const handleSaveItem = async () => {
    if (!newItem.name) return;
    setIsAdding(true);
    try {
      const sanitizedItem = {
        ...newItem,
        quantity: Number.isNaN(newItem.quantity) ? 0 : newItem.quantity
      };
      await addDocumentNonBlocking(collection(firestore, 'consumables'), sanitizedItem);
      setNewItem({ name: '', description: '', quantity: 0, unit: 'Units', category: 'General' });
      toast({ title: "Stock Loaded", description: `${newItem.name} added to inventory.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setIsAdding(false);
    }
  };

  const handleScanDeliveryNote = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setSelectedFileName(file.name);
    
    if (file.type.startsWith('image/')) {
        setScanFilePreview(URL.createObjectURL(file));
    } else {
        setScanFilePreview(null);
    }
    
    setScannedItems(null);
    
    try {
      const dataUri = await fileToDataUri(file);
      const result = await extractConsumablesData({ imageDataUri: dataUri });
      setScannedItems(result.items);
      toast({ title: "Scan Complete", description: `Extracted ${result.items.length} items from document.` });
    } catch (error: any) {
      console.error(error);
      toast({ 
        variant: 'destructive', 
        title: "Scan Failed", 
        description: error.message || "Could not read the document. Ensure it is a clear scan of a PO, Invoice, or Delivery Note." 
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleAcceptScannedItems = async () => {
    if (!scannedItems || !firestore) return;
    setIsAdding(true);
    try {
      const batch = writeBatch(firestore);
      const colRef = collection(firestore, 'consumables');
      
      for (const item of scannedItems) {
        const newDocRef = doc(colRef);
        batch.set(newDocRef, {
          ...item,
          quantity: Number.isNaN(item.quantity) ? 0 : item.quantity,
          createdAt: new Date().toISOString()
        });
      }
      
      await batch.commit();
      toast({ title: "Inventory Updated", description: "All scanned items have been added to stock." });
      setScannedItems(null);
      setScanFilePreview(null);
      setSelectedFileName(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Upload Failed", description: error.message });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this item from inventory?")) {
      deleteDocumentNonBlocking(doc(firestore, 'consumables', id));
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    try {
      const itemRef = doc(firestore, 'consumables', editingItem.id);
      updateDocumentNonBlocking(itemRef, {
        name: editForm.name,
        category: editForm.category,
        unit: editForm.unit,
      });
      toast({ title: "Item Updated", description: `${editForm.name} details saved.` });
      setEditingPO(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Update Failed", description: e.message });
    }
  };

  const handleRestock = async () => {
    if (!restockingItem) return;
    const addQty = Number.isNaN(restockQty) ? 0 : restockQty;
    if (addQty <= 0) return;

    try {
      const itemRef = doc(firestore, 'consumables', restockingItem.id);
      const newTotal = (restockingItem.quantity || 0) + addQty;
      updateDocumentNonBlocking(itemRef, { quantity: newTotal });
      toast({ title: "Stock Replenished", description: `Added ${addQty} ${restockingItem.unit} to ${restockingItem.name}.` });
      setRestockingItem(null);
      setRestockQty(0);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Restock Failed", description: e.message });
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Consumables Inventory</h1>
          <p className="text-muted-foreground">Manage and request site consumables (grease, rods, fluids, etc.).</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/consumables/ipr">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
              <History className="mr-2 h-4 w-4" /> IPR Tracker
            </Button>
          </Link>
          
          {isAdmin && (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                    <ScanLine className="mr-2 h-4 w-4" /> Scan PO / Delivery Note
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>AI Document Scanner</DialogTitle>
                    <DialogDescription>Upload a photo or PDF of your PO, Delivery Note, or Invoice to fast-track item entry.</DialogDescription>
                  </DialogHeader>
                  
                  <div className="flex-1 overflow-y-auto py-4">
                    {!scannedItems && !isScanning && (
                      <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 bg-slate-50">
                        <Package className="h-12 w-12 text-slate-300 mb-4" />
                        <Label htmlFor="scan-input" className="cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
                          Select Document (Image or PDF)
                        </Label>
                        <Input id="scan-input" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleScanDeliveryNote} />
                        <p className="text-xs text-slate-400 mt-4 text-center">AI supports Image and PDF formats for auto-recognition.</p>
                      </div>
                    )}

                    {isScanning && (
                      <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                        <p className="font-medium text-slate-700 uppercase tracking-widest text-xs">AI is analyzing {selectedFileName}...</p>
                      </div>
                    )}

                    {scannedItems && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border rounded-md overflow-hidden bg-slate-100 relative aspect-[3/4] flex items-center justify-center">
                            {scanFilePreview ? (
                              <Image 
                                src={scanFilePreview} 
                                alt="Document Preview" 
                                fill 
                                className="object-contain" 
                              />
                            ) : (
                                <div className="text-center p-4">
                                    <FileText className="h-16 w-16 text-blue-500 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-700">{selectedFileName}</p>
                                    <p className="text-xs text-slate-500 italic">Document recognized</p>
                                </div>
                            )}
                          </div>
                          <div className="space-y-2 flex flex-col">
                            <h4 className="font-bold text-sm uppercase text-slate-500">Extracted Items</h4>
                            <ScrollArea className="flex-1 min-h-[300px] border rounded-md p-2 bg-slate-50">
                              {scannedItems.map((item, idx) => (
                                <div key={idx} className="bg-white p-3 rounded border mb-2 shadow-sm border-l-4 border-l-emerald-500">
                                  <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                                    <span className="font-mono">Qty: {item.quantity} {item.unit}</span>
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">{item.category}</Badge>
                                  </div>
                                </div>
                              ))}
                            </ScrollArea>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {scannedItems && (
                    <DialogFooter className="mt-4 border-t pt-4">
                      <Button variant="ghost" onClick={() => { setScannedItems(null); setScanFilePreview(null); setSelectedFileName(null); }}>
                        <X className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                      <Button onClick={handleAcceptScannedItems} disabled={isAdding} className="bg-emerald-600 hover:bg-emerald-700">
                        {isAdding ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />}
                        Accept & Upload to Stock
                      </Button>
                    </DialogFooter>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Load Stock Manually
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Consumable to Stock</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Item Name</Label>
                      <Input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. Lithium Grease 500g" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Category</Label>
                      <Input value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} placeholder="e.g. Lubricants" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Initial Quantity</Label>
                        <Input 
                          type="number" 
                          value={Number.isNaN(newItem.quantity) ? "" : newItem.quantity} 
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setNewItem({...newItem, quantity: val});
                          }} 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Unit</Label>
                        <Input value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} placeholder="KG, L, Unit" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Description (Optional)</Label>
                      <Input value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSaveItem} disabled={isAdding || !newItem.name}>
                      {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save to Inventory"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Stock List
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search consumables..." 
                className="pl-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Available Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium pl-6">{item.name}</TableCell>
                    <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-bold", (item.quantity || 0) < 5 ? "text-red-600" : "text-slate-900")}>
                        {item.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm uppercase">{item.unit}</TableCell>
                    <TableCell className="text-right pr-6 space-x-2">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/inventory/consumables/order?itemId=${item.id}`}>
                          <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10">
                            <ShoppingCart className="mr-2 h-4 w-4" /> Request
                          </Button>
                        </Link>
                        
                        {isAdmin && (
                          <>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-slate-400 hover:text-primary"
                              onClick={() => {
                                setEditingPO(item);
                                setEditForm({ name: item.name, category: item.category || '', unit: item.unit });
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-slate-400 hover:text-emerald-600"
                              onClick={() => {
                                setRestockingItem(item);
                                setRestockQty(0);
                              }}
                            >
                              <PlusSquare className="h-4 w-4" />
                            </Button>
                            
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="text-slate-400 hover:text-red-600" 
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">
                    No consumables found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* RE-STOCK ALERT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-orange-800 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {consumables?.filter(i => (i.quantity || 0) < 5).map(i => (
                <div key={i.id} className="flex justify-between items-center text-sm">
                  <span className="font-medium">{i.name}</span>
                  <Badge variant="destructive">{i.quantity} {i.unit} left</Badge>
                </div>
              ))}
              {!consumables?.some(i => (i.quantity || 0) < 5) && (
                <p className="text-xs text-orange-600 italic">All essential stock levels are healthy.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* EDIT DIALOG */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingPO(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Consumable</DialogTitle>
            <DialogDescription>Update the master record for this inventory item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Item Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Input value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Unit of Measure</Label>
              <Input value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} placeholder="KG, L, Unit" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPO(null)}>Cancel</Button>
            <Button onClick={handleUpdateItem}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESTOCK DIALOG */}
      <Dialog open={!!restockingItem} onOpenChange={(open) => !open && setRestockingItem(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Quick Restock</DialogTitle>
            <DialogDescription>Add new stock to the current inventory for <strong>{restockingItem?.name}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-dashed">
              <span className="text-sm text-slate-500 font-medium">Current Stock:</span>
              <span className="text-lg font-black text-slate-900">{restockingItem?.quantity} {restockingItem?.unit}</span>
            </div>
            <div className="space-y-2">
              <Label>Quantity to ADD</Label>
              <div className="relative">
                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                <Input 
                  type="number" 
                  className="pl-9 text-lg font-bold" 
                  placeholder="0"
                  value={restockQty || ''}
                  onChange={e => setRestockQty(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRestockingItem(null)}>Cancel</Button>
            <Button onClick={handleRestock} disabled={!restockQty || restockQty <= 0} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="mr-2 h-4 w-4" /> Confirm Restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
