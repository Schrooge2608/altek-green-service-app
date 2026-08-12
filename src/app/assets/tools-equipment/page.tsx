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
  History, 
  LayoutGrid,
  ShieldAlert,
  Save,
  UserPlus,
  CheckCircle2,
  Trash2,
  Pencil,
  Settings2,
  AlertTriangle
} from 'lucide-react';
import { 
  useCollection, 
  useFirebase, 
  useMemoFirebase, 
  useUser,
  useDoc,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { User, Asset } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function ToolsAndEquipmentPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Allocation State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [allocatingAsset, setAllocatingAsset] = useState<Asset | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Status Update State
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusUpdatingAsset, setStatusUpdatingAsset] = useState<Asset | null>(null);
  const [updateStatusValue, setUpdateStatusValue] = useState<string>('');
  const [updateStatusReason, setUpdateStatusReason] = useState<string>('');

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
  
  const isClientManager = userData?.role === 'Client Manager';
  const isAdmin = userData?.role && ['Admin', 'Superadmin', 'Services Manager', 'Site Supervisor'].includes(userData.role);

  // 2. Fetch Assets
  const assetsQuery = useMemoFirebase(
    () => {
      if (!firestore || !userData || isClientManager) return null;
      return query(collection(firestore, 'assets'), orderBy('assetsNewNumber', 'asc'));
    },
    [firestore, userData, isClientManager]
  );
  const { data: assets, isLoading: assetsLoading } = useCollection<Asset>(assetsQuery);

  // 3. Fetch Technicians for Allocation
  const usersQuery = useMemoFirebase(
    () => query(collection(firestore, 'users'), orderBy('name', 'asc')),
    [firestore]
  );
  const { data: allUsers } = useCollection<User>(usersQuery);

  const technicians = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.role?.includes('Technician') || 
      u.role?.includes('Engineer') || 
      u.role?.includes('Technologist') ||
      u.role?.includes('specialist')
    );
  }, [allUsers]);

  const isLoading = userDataLoading || assetsLoading;

  // 4. Search Filtering
  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    return assets.filter(a => 
      a.assetsNewNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assetDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
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
      toast({ title: "Asset Registered", description: `Added ${newAsset.assetsNewNumber} to the register.` });
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

  const handleAllocate = async () => {
    if (!allocatingAsset || !selectedUserId) return;
    
    const selectedTech = technicians.find(t => t.id === selectedUserId);
    if (!selectedTech) return;

    setIsSaving(true);
    try {
      const assetRef = doc(firestore, 'assets', allocatingAsset.id);
      updateDocumentNonBlocking(assetRef, {
        user: selectedTech.name,
        status: 'In Use',
        updatedAt: new Date().toISOString()
      });

      toast({ 
        title: "Asset Allocated", 
        description: `${allocatingAsset.assetsNewNumber} has been assigned to ${selectedTech.name}.` 
      });
      
      setIsAllocateModalOpen(false);
      setAllocatingAsset(null);
      setSelectedUserId('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Allocation Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusUpdatingAsset) return;

    setIsSaving(true);
    try {
      const assetRef = doc(firestore, 'assets', statusUpdatingAsset.id);
      updateDocumentNonBlocking(assetRef, {
        status: updateStatusValue,
        lostReason: updateStatusReason,
        updatedAt: new Date().toISOString()
      });

      toast({ 
        title: "Status Updated", 
        description: `Asset ${statusUpdatingAsset.assetsNewNumber} is now marked as ${updateStatusValue}.` 
      });
      
      setIsStatusModalOpen(false);
      setStatusUpdatingAsset(null);
      setUpdateStatusReason('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Update Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAsset = (assetId: string, assetNumber: string) => {
    try {
      deleteDocumentNonBlocking(doc(firestore, 'assets', assetId));
      toast({ title: "Asset Deleted", description: `${assetNumber} has been removed from the registry.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Delete Failed", description: e.message });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Available': 
      case 'Operational': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Operational</Badge>;
      case 'In Use': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">In Use</Badge>;
      case 'In Store': return <Badge variant="secondary">In Store</Badge>;
      case 'Maintenance':
      case 'In Repair': return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">In Repair</Badge>;
      case 'Lost': return <Badge variant="destructive">Lost</Badge>;
      case 'Stolen': return <Badge variant="destructive" className="bg-red-200 text-red-900 border-red-300">Stolen</Badge>;
      case 'Written Off': return <Badge variant="secondary" className="opacity-60">Written Off</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (userData && isClientManager) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-muted-foreground max-w-xs mt-2">
          The internal tool and asset registry is reserved for Altek maintenance staff only.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 bg-background">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tools & Equipment</h1>
          <p className="text-muted-foreground">Comprehensive register for site logistics and asset tracking.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary">
                  <Plus className="mr-2 h-4 w-4" /> Add Tool
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
          )}
        </div>
      </header>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <LayoutGrid className="h-5 w-5 text-primary" /> Master Asset Register
              </CardTitle>
              <CardDescription>Real-time inventory of all high-value tools and electronics.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by ID, SN, or Model..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="pl-6 font-bold whitespace-nowrap">Assets New Number</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Asset Type</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Asset Description</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Make</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Model</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Serial Number</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Company</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Site</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">User</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Cost</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Purchase Date</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Status</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Lost - Reason</TableHead>
                  <TableHead className="text-right pr-6 font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={14} className="h-32 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin h-5 w-5 text-primary" />
                        <span className="text-slate-500 font-medium">Synchronizing database...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAssets.length > 0 ? (
                  filteredAssets.map(asset => (
                    <TableRow key={asset.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-mono font-bold text-primary pl-6">{asset.assetsNewNumber}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-600">{asset.assetType}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-sm">{asset.assetDescription}</TableCell>
                      <TableCell className="text-sm font-medium">{asset.make}</TableCell>
                      <TableCell className="text-sm">{asset.model}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{asset.serialNumber}</TableCell>
                      <TableCell className="text-sm">{asset.company}</TableCell>
                      <TableCell className="text-sm">{asset.site}</TableCell>
                      <TableCell className="text-sm font-semibold text-slate-700">
                        {asset.user || <span className="text-slate-300 italic">Unallocated</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {asset.cost ? `R ${asset.cost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {asset.purchaseDate || 'N/A'}
                      </TableCell>
                      <TableCell>{getStatusBadge(asset.status)}</TableCell>
                      <TableCell className="text-xs text-red-500 italic max-w-[120px] truncate">
                        {asset.lostReason || '-'}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                          {isAdmin && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-primary hover:bg-primary/5 h-8 px-2"
                                onClick={() => {
                                  setAllocatingAsset(asset);
                                  setIsAllocateModalOpen(true);
                                }}
                              >
                                <UserPlus className="h-4 w-4 mr-1" /> Allocate
                              </Button>

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-amber-600"
                                onClick={() => {
                                  setStatusUpdatingAsset(asset);
                                  setUpdateStatusValue(asset.status);
                                  setUpdateStatusReason(asset.lostReason || '');
                                  setIsStatusModalOpen(true);
                                }}
                                title="Update Status"
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
                            <History className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action will permanently delete the record for asset <strong>{asset.assetsNewNumber}</strong>. 
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => handleDeleteAsset(asset.id, asset.assetsNewNumber)}
                                  >
                                    Delete Asset
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={14} className="h-48 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Package className="h-12 w-12 opacity-10" />
                        <div className="space-y-1">
                          <p className="font-bold text-slate-500">No assets found</p>
                          <p className="text-xs">Adjust your search to find records.</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Allocate Equipment Dialog */}
      <Dialog open={isAllocateModalOpen} onOpenChange={setIsAllocateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Allocate Equipment</DialogTitle>
            <DialogDescription>
              Assign <strong>{allocatingAsset?.assetsNewNumber}</strong> to a responsible staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Select Personnel</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose technician..." />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Asset Context</p>
              <p className="text-sm font-medium">{allocatingAsset?.assetDescription}</p>
              <p className="text-xs text-slate-400 mt-1">{allocatingAsset?.make} {allocatingAsset?.model}</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleAllocate} 
              disabled={isSaving || !selectedUserId}
              className="bg-primary"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Asset Status</DialogTitle>
            <DialogDescription>
              Modify the operational status for <strong>{statusUpdatingAsset?.assetsNewNumber}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Operational Status</Label>
              <Select value={updateStatusValue} onValueChange={setUpdateStatusValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Operational / Available</SelectItem>
                  <SelectItem value="In Use">In Use</SelectItem>
                  <SelectItem value="Maintenance">In Repair / Maintenance</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
                  <SelectItem value="Stolen">Stolen</SelectItem>
                  <SelectItem value="Written Off">Written Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status Reason / Audit Notes</Label>
              <Textarea 
                placeholder="Log exactly how or why the status changed (e.g., reported missing from site B)..." 
                value={updateStatusReason}
                onChange={e => setUpdateStatusReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleUpdateStatus} 
              disabled={isSaving}
              className="bg-primary"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Update & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
