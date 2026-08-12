'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as CardDesc } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, 
  Search, 
  Loader2, 
  Briefcase, 
  FileText, 
  Trash2, 
  Pencil, 
  ExternalLink,
  Upload,
  CheckCircle2,
  X,
  Save
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Client, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function ClientManagementPage() {
  const { firestore, firebaseApp } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    companyName: '',
    billingAddress: '',
    vatNumber: '',
    contactPerson: '',
    email: '',
    phone: '',
    slaContractNumber: '',
    contractStartDate: '',
    contractEndDate: '',
    designatedLeader: '',
    responsibleManager: '',
    department: '',
    section: '',
    justification: '',
  });

  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // 1. Permissions Check
  const userRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRef);
  const isManagement = userData?.role && ['Admin', 'Superadmin', 'Services Manager', 'Corporate Manager'].includes(userData.role);

  // 2. Fetch Clients
  const clientsQuery = useMemoFirebase(
    () => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')),
    [firestore]
  );
  const { data: clients, isLoading } = useCollection<Client>(clientsQuery);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter(c => 
      c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      toast({ variant: 'destructive', title: "Invalid File", description: "Only PDF documents are supported for SLA agreements." });
    }
  };

  const resetForm = () => {
    setFormData({
      companyName: '',
      billingAddress: '',
      vatNumber: '',
      contactPerson: '',
      email: '',
      phone: '',
      slaContractNumber: '',
      contractStartDate: '',
      contractEndDate: '',
      designatedLeader: '',
      responsibleManager: '',
      department: '',
      section: '',
      justification: '',
    });
    setSelectedFile(null);
    setEditingClient(null);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.email) {
      toast({ variant: 'destructive', title: "Validation Error", description: "Company Name and Email are required." });
      return;
    }

    setIsSaving(true);
    try {
      const storage = getStorage(firebaseApp);
      let slaUrl = editingClient?.slaUrl || '';
      let slaFileName = editingClient?.slaFileName || '';

      // 1. Upload SLA if provided
      if (selectedFile) {
        const storagePath = `clients/slas/${Date.now()}_${selectedFile.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, selectedFile);
        slaUrl = await getDownloadURL(storageRef);
        slaFileName = selectedFile.name;
      }

      const payload = {
        ...formData,
        slaUrl,
        slaFileName,
        updatedAt: serverTimestamp(),
      };

      if (editingClient) {
        updateDocumentNonBlocking(doc(firestore, 'clients', editingClient.id), payload);
        toast({ title: "Client Updated", description: `${formData.companyName} details have been saved.` });
      } else {
        await addDocumentNonBlocking(collection(firestore, 'clients'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Client Added", description: `New client ${formData.companyName} created successfully.` });
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Save Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = (client: Client) => {
    if (!confirm(`Are you sure you want to delete ${client.companyName}?`)) return;
    deleteDocumentNonBlocking(doc(firestore, 'clients', client.id));
    toast({ title: "Client Removed", description: "The client record has been deleted." });
  };

  if (!isManagement && !isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Access Restricted to Administrators and Site Managers.</div>;
  }

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8 bg-background">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Client Management</h1>
          <p className="text-muted-foreground">Manage billing details, VAT numbers, and SLA documentation.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary" onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" /> Add New Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[95vh] flex flex-col p-0 overflow-hidden">
              <div className="p-6 pb-4 shrink-0 border-b">
                <DialogHeader>
                  <DialogTitle>{editingClient ? 'Edit Client' : 'Register New Client'}</DialogTitle>
                  <DialogDescription>Capture core business details and legal documentation.</DialogDescription>
                </DialogHeader>
              </div>

              <form onSubmit={handleSaveClient} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input 
                        value={formData.companyName} 
                        onChange={e => setFormData({...formData, companyName: e.target.value})} 
                        placeholder="e.g. Rio Tinto - RBM"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>VAT Number</Label>
                      <Input 
                        value={formData.vatNumber} 
                        onChange={e => setFormData({...formData, vatNumber: e.target.value})} 
                        placeholder="VAT #"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Billing Address</Label>
                    <Textarea 
                      value={formData.billingAddress} 
                      onChange={e => setFormData({...formData, billingAddress: e.target.value})} 
                      placeholder="Full postal address for invoicing..."
                      rows={3}
                    />
                  </div>
                  <Separator />
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Person</Label>
                      <Input 
                        value={formData.contactPerson} 
                        onChange={e => setFormData({...formData, contactPerson: e.target.value})} 
                        placeholder="Primary contact name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input 
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value})} 
                        placeholder="e.g. +27..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input 
                      type="email"
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      placeholder="billing@client.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SLA Contract Number</Label>
                    <Input 
                      value={formData.slaContractNumber} 
                      onChange={e => setFormData({...formData, slaContractNumber: e.target.value})} 
                      placeholder="e.g., CW22038313"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contract Start Date</Label>
                      <Input 
                        type="date"
                        value={formData.contractStartDate} 
                        onChange={e => setFormData({...formData, contractStartDate: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contract End Date</Label>
                      <Input 
                        type="date"
                        value={formData.contractEndDate} 
                        onChange={e => setFormData({...formData, contractEndDate: e.target.value})} 
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Designated Leader</Label>
                      <Input 
                        value={formData.designatedLeader} 
                        onChange={e => setFormData({...formData, designatedLeader: e.target.value})} 
                        placeholder="Name..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Responsible Manager</Label>
                      <Input 
                        value={formData.responsibleManager} 
                        onChange={e => setFormData({...formData, responsibleManager: e.target.value})} 
                        placeholder="Name..."
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input 
                        value={formData.department} 
                        onChange={e => setFormData({...formData, department: e.target.value})} 
                        placeholder="e.g. Electrical"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Section</Label>
                      <Input 
                        value={formData.section} 
                        onChange={e => setFormData({...formData, section: e.target.value})} 
                        placeholder="e.g. Maintenance"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Justification</Label>
                    <Textarea 
                      value={formData.justification} 
                      onChange={e => setFormData({...formData, justification: e.target.value})} 
                      placeholder="Briefly describe the business need..."
                      rows={3}
                    />
                  </div>

                  <Separator />
                  <div className="space-y-2">
                    <Label>SLA Agreement (PDF)</Label>
                    <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center bg-slate-50">
                      <Upload className="h-8 w-8 text-slate-300 mb-2" />
                      <Input 
                        type="file" 
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400 mt-2 text-center uppercase font-bold tracking-wider">
                        {editingClient?.slaFileName ? `Current: ${editingClient.slaFileName}` : "Upload signed PDF contract"}
                      </p>
                    </div>
                    {selectedFile && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold mt-2">
                        <CheckCircle2 className="h-3 w-3" /> Ready: {selectedFile.name}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 pt-4 shrink-0 border-t bg-slate-50/50">
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingClient ? 'Save Changes' : 'Register Client'}
                    </Button>
                  </DialogFooter>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" /> Active Client Accounts
            </CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search clients..." 
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
                <TableHead className="pl-6 font-bold">Company</TableHead>
                <TableHead className="font-bold">Contact Person</TableHead>
                <TableHead className="font-bold">VAT Number</TableHead>
                <TableHead className="font-bold">Email / Phone</TableHead>
                <TableHead className="font-bold">SLA Document</TableHead>
                <TableHead className="text-right pr-6 font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center"><Loader2 className="animate-spin mx-auto h-6 w-6 text-slate-300" /></TableCell></TableRow>
              ) : filteredClients.length > 0 ? (
                filteredClients.map(client => (
                  <TableRow key={client.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-bold text-slate-800 pl-6">{client.companyName}</TableCell>
                    <TableCell className="text-sm font-medium">{client.contactPerson}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{client.vatNumber || 'N/A'}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <div>{client.email}</div>
                      <div>{client.phone}</div>
                    </TableCell>
                    <TableCell>
                      {client.slaUrl ? (
                        <a 
                          href={client.slaUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center text-emerald-600 font-bold hover:underline"
                        >
                          <FileText className="h-4 w-4 mr-1" /> View SLA
                        </a>
                      ) : (
                        <span className="text-slate-300 italic text-xs">No SLA linked</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingClient(client);
                            setFormData({
                              companyName: client.companyName || '',
                              billingAddress: client.billingAddress || '',
                              vatNumber: client.vatNumber || '',
                              contactPerson: client.contactPerson || '',
                              email: client.email || '',
                              phone: client.phone || '',
                              slaContractNumber: client.slaContractNumber || '',
                              contractStartDate: client.contractStartDate || '',
                              contractEndDate: client.contractEndDate || '',
                              designatedLeader: client.designatedLeader || '',
                              responsibleManager: client.responsibleManager || '',
                              department: client.department || '',
                              section: client.section || '',
                              justification: client.justification || '',
                            });
                            setIsModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-400 hover:text-red-600"
                          onClick={() => handleDeleteClient(client)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">
                    No client accounts found.
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