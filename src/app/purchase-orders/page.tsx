'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ShoppingCart, 
  ShieldAlert, 
  Loader2, 
  Plus, 
  FileText, 
  Upload, 
  Search, 
  ExternalLink,
  Calendar,
  User as UserIcon,
  CheckCircle2,
  Pencil,
  Save
} from 'lucide-react';
import { 
  useUser, 
  useDoc, 
  useFirestore, 
  useMemoFirebase, 
  useCollection,
  useFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking
} from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { User, PurchaseOrder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PurchaseOrdersPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const { firestore, firebaseApp } = useFirebase();
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State for Upload
  const [poNumber, setPoNumber] = useState('');
  const [calloutDate, setCalloutDate] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form State for Editing
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [editForm, setEditForm] = useState({ poNumber: '', description: '', calloutDate: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. Role Check
  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData, isLoading: userRoleLoading } = useDoc<User>(userRoleRef);

  // 2. Fetch POs
  const poQuery = useMemoFirebase(
    () => query(collection(firestore, 'purchase_orders'), orderBy('calloutDate', 'desc')),
    [firestore]
  );
  const { data: purchaseOrders, isLoading: posLoading } = useCollection<PurchaseOrder>(poQuery);

  const isManagement = useMemo(() => {
    if (!userData?.role) return false;
    const managementRoles = ['Admin', 'Superadmin', 'Client Manager', 'Corporate Manager', 'Services Manager', 'Site Supervisor'];
    return managementRoles.includes(userData.role);
  }, [userData]);

  const filteredPOs = useMemo(() => {
    if (!purchaseOrders) return [];
    return purchaseOrders.filter(po => 
      po.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.uploadedBy?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [purchaseOrders, searchTerm]);

  const handleUploadPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !poNumber || !calloutDate || !user) {
      toast({ variant: 'destructive', title: "Validation Error", description: "PO Number, Callout Date and PDF file are required." });
      return;
    }
    
    setIsUploading(true);
    try {
      const storage = getStorage(firebaseApp);
      
      // 1. Upload PDF to Firebase Storage
      const storagePath = `purchase_orders/${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, selectedFile);
      const downloadUrl = await getDownloadURL(storageRef);
      
      // 2. Save record to Firestore (Non-Blocking)
      addDocumentNonBlocking(collection(firestore, 'purchase_orders'), {
        poNumber: poNumber.toUpperCase(),
        calloutDate,
        description,
        fileUrl: downloadUrl,
        uploadedBy: userData?.name || user?.email || 'Unknown',
        uploadedByUid: user?.uid,
        uploadedAt: new Date().toISOString(),
        status: 'Active'
      });
      
      toast({ title: "PO Uploaded", description: `Purchase Order ${poNumber} has been successfully stored.` });
      
      // Reset Form
      setPoNumber('');
      setCalloutDate('');
      setDescription('');
      setSelectedFile(null);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Upload failed", error);
      toast({ variant: 'destructive', title: "Upload Failed", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPO) return;
    
    setIsUpdating(true);
    try {
      const poRef = doc(firestore, 'purchase_orders', editingPO.id); 
      updateDocumentNonBlocking(poRef, {
        poNumber: editForm.poNumber.toUpperCase(),
        description: editForm.description,
        calloutDate: editForm.calloutDate
      });
      toast({ title: "Purchase Order Updated", description: `The changes for PO ${editForm.poNumber} have been saved.` });
      setEditingPO(null);
    } catch (error: any) {
      console.error("Update failed", error);
      toast({ variant: 'destructive', title: "Update Failed", description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isAuthLoading || userRoleLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isManagement) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
        <div className="bg-red-50 p-6 rounded-full mb-6">
          <ShieldAlert className="w-16 h-16 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Restricted Access</h2>
        <p className="text-slate-500 max-sm mt-2">
          You do not have the required permissions to view or manage site financial documents. 
          Please contact your administrator if this is an error.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Purchase Orders</h1>
          <p className="text-muted-foreground">Digital repository for active site Purchase Orders.</p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary">
              <Plus className="mr-2 h-4 w-4" />
              Upload New PO
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload Purchase Order</DialogTitle>
              <CardDescription>Attach a PDF version of the PO for site authorization records.</CardDescription>
            </DialogHeader>
            <form onSubmit={handleUploadPO} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="po-number">PO Number</Label>
                <Input 
                  id="po-number" 
                  placeholder="e.g. PO-2026-0045" 
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  className="uppercase font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="callout-date">Callout Date</Label>
                <Input 
                  id="callout-date" 
                  type="date"
                  value={calloutDate}
                  onChange={e => setCalloutDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-desc">Description (Optional)</Label>
                <Textarea 
                  id="po-desc" 
                  placeholder="e.g. Callout for MPC Booster Pump Repairs" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-file">PDF Document</Label>
                <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center bg-slate-50">
                  <Upload className="h-8 w-8 text-slate-300 mb-2" />
                  <Input 
                    id="po-file" 
                    type="file" 
                    accept="application/pdf"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    className="cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">Only PDF documents are supported for financial archiving.</p>
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold mt-2">
                    <CheckCircle2 className="h-3 w-3" />
                    {selectedFile.name}
                  </div>
                )}
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isUploading || !poNumber || !selectedFile || !calloutDate}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {isUploading ? 'Uploading...' : 'Upload & Archive'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-6">
        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search POs by number, vendor, or creator..." 
            className="pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="pl-6 font-bold">PO Number</TableHead>
                  <TableHead className="font-bold">Description</TableHead>
                  <TableHead className="font-bold">Callout Date</TableHead>
                  <TableHead className="font-bold">Uploaded By</TableHead>
                  <TableHead className="text-right pr-6 font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="animate-spin mx-auto h-6 w-6 text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : filteredPOs.length > 0 ? (
                  filteredPOs.map((po) => (
                    <TableRow key={po.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="pl-6 font-mono font-bold text-primary">
                        {po.poNumber}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-slate-600 italic">
                        {po.description || 'No description provided'}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {po.calloutDate ? format(new Date(po.calloutDate), 'dd MMM yyyy') : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700 font-medium">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-3 w-3 text-slate-400" />
                          {po.uploadedBy}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center gap-3 justify-end">
                          <a 
                            href={po.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3 border border-input bg-background hover:bg-slate-100 text-emerald-700 border-emerald-200"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            PDF
                            <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                          </a>
                          
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingPO(po);
                              setEditForm({ 
                                poNumber: po.poNumber || '', 
                                description: po.description || '', 
                                calloutDate: po.calloutDate || '' 
                              });
                            }}
                            className="text-slate-600 hover:text-primary h-9 px-3"
                          >
                            <Pencil className="w-4 h-4 mr-2" /> 
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 italic">
                      <div className="flex flex-col items-center gap-2">
                        <ShoppingCart className="h-8 w-8 opacity-20" />
                        <p>No Purchase Orders found matching your criteria.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingPO} onOpenChange={(open) => !open && setEditingPO(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
            <CardDescription>Update the details for this record. PDF documents cannot be changed here.</CardDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePO} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-po-number">PO Number</Label>
              <Input 
                id="edit-po-number" 
                value={editForm.poNumber}
                onChange={e => setEditForm({...editForm, poNumber: e.target.value})}
                className="uppercase font-mono"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-callout-date">Callout Date</Label>
              <Input 
                id="edit-callout-date" 
                type="date"
                value={editForm.calloutDate}
                onChange={e => setEditForm({...editForm, calloutDate: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-po-desc">Description</Label>
              <Textarea 
                id="edit-po-desc" 
                value={editForm.description}
                onChange={e => setEditForm({...editForm, description: e.target.value})}
                rows={3}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditingPO(null)}>Cancel</Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
