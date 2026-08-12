'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Loader2, 
  Package, 
  UserPlus, 
  LayoutGrid,
  ShieldAlert,
  Save
} from 'lucide-react';
import { 
  useCollection, 
  useFirebase, 
  useMemoFirebase, 
  useUser,
  useDoc,
  addDocumentNonBlocking
} from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Asset, User } from '@/lib/types';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function AssetsRegistryPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New Asset Form State
  const [newAsset, setNewAsset] = useState<Partial<Asset>>({
    assetsNewNumber: '',
    assetType: 'Tool',
    assetDescription: '',
    make: '',
    model: '',
    serialNumber: '',
    company: 'Altek Green',
    site: 'Mining',
    status: 'Available',
    cost: 0,
    purchaseDate: '',
  });

  // 1. Permissions Check
  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData, isLoading: userDataLoading } = useDoc<User>(userRef);
  const isAdmin = userData?.role && ['Admin', 'Superadmin'].includes(userData.role);

  // 2. Fetch Assets
  const assetsQuery = useMemoFirebase(
    () => {
      if (!firestore || !isAdmin) return null;
      return query(collection(firestore, 'assets'), orderBy('assetsNewNumber', 'asc'));
    },
    [firestore, isAdmin]
  );
  const { data: assets, isLoading: assetsLoading } = useCollection<Asset>(assetsQuery);

  const isLoading = userDataLoading || assetsLoading;

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    return assets.filter(a => 
      a.assetsNewNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assetDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.model?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [assets, searchTerm]);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.assetsNewNumber || !newAsset.assetDescription) return;

    setIsSaving(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'assets'), {
        ...newAsset,
        createdAt: new Date().toISOString(),
      });
      toast({ title: "Asset Registered", description: `Added ${newAsset.assetsNewNumber} to the registry.` });
      setIsAddModalOpen(false);
      setNewAsset({
        assetsNewNumber: '',
        assetType: 'Tool',
        assetDescription: '',
        make: '',
        model: '',
        serialNumber: '',
        company: 'Altek Green',
        site: 'Mining',
        status: 'Available',
        cost: 0,
        purchaseDate: '',
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: Asset['status']) => {
    switch (status) {
      case 'Available': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Available</Badge>;
      case 'In Use': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">In Use</Badge>;
      case 'In Store': return <Badge variant="secondary">In Store</Badge>;
      case 'Maintenance': return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Maintenance</Badge>;
      case 'Lost': return <Badge variant="destructive">Lost</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (userData && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-muted-foreground max-w-xs mt-2">
          Only administrators can view or manage the high-value asset registry.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 bg-background">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Asset Registry</h1>
          <p className="text-muted-foreground">Manage high-value site equipment, electronics, and tools.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary">
                <Plus className="mr-2 h-4 w-4" /> Add New Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Register New Asset</DialogTitle>
                <DialogDescription>Add a high-value tool or electronic device to the master register.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddAsset} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Asset Number</Label>
                    <Input placeholder="e.g. AG-TOOL-001" value={newAsset.assetsNewNumber} onChange={e => setNewAsset({...newAsset, assetsNewNumber: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Asset Type</Label>
                    <Input placeholder="e.g. Multimeter" value={newAsset.assetType} onChange={e => setNewAsset({...newAsset, assetType: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Detailed description..." value={newAsset.assetDescription} onChange={e => setNewAsset({...newAsset, assetDescription: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Make</Label>
                    <Input placeholder="e.g. Fluke" value={newAsset.make} onChange={e => setNewAsset({...newAsset, make: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input placeholder="e.g. 179 RMS" value={newAsset.model} onChange={e => setNewAsset({...newAsset, model: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Serial Number</Label>
                    <Input placeholder="S/N..." value={newAsset.serialNumber} onChange={e => setNewAsset({...newAsset, serialNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Date</Label>
                    <Input type="date" value={newAsset.purchaseDate} onChange={e => setNewAsset({...newAsset, purchaseDate: e.target.value})} />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Asset
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <LayoutGrid className="h-5 w-5 text-primary" /> Master Ledger
              </CardTitle>
              <CardDescription>Real-time inventory tracking for all site assets.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search assets..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="pl-6 font-bold">Asset #</TableHead>
                <TableHead className="font-bold">Type</TableHead>
                <TableHead className="font-bold">Description</TableHead>
                <TableHead className="font-bold">Make/Model</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold">Assigned To</TableHead>
                <TableHead className="text-right pr-6 font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6 text-slate-300" /></TableCell></TableRow>
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map(asset => (
                  <TableRow key={asset.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-mono font-bold text-primary pl-6">{asset.assetsNewNumber}</TableCell>
                    <TableCell className="text-sm font-medium text-slate-600">{asset.assetType}</TableCell>
                    <TableCell className="max-w-xs truncate">{asset.assetDescription}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      <div className="font-bold text-slate-700">{asset.make}</div>
                      <div>{asset.model}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                    <TableCell className="text-sm font-semibold text-slate-700">
                      {asset.user || <span className="text-slate-300 italic">None</span>}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="outline" size="sm" className="text-primary border-primary/20 hover:bg-primary/5">
                        <UserPlus className="mr-2 h-4 w-4" /> Allocate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 opacity-20" />
                      <p>No asset records found matching your search.</p>
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
