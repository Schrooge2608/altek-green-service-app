'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { 
  useUser, 
  useFirestore, 
  useMemoFirebase, 
  updateDocumentNonBlocking,
  useCollection
} from '@/firebase';
import type { User, Client } from '@/lib/types';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { 
  Loader2, 
  ShieldAlert, 
  Building2, 
  Pencil, 
  FileText, 
  ExternalLink,
  Save,
  X
} from 'lucide-react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useParams, notFound, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import backendConfig from '@/docs/backend.json';
import { cn } from '@/lib/utils';

// --- SCHEMAS ---

const officialInfoSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please provide a valid email.'),
  sapNumber: z.string().optional(),
  qualifications: z.string().optional(),
  role: z.string().optional(),
  clientId: z.string().optional(),
});

const contactInfoSchema = z.object({
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
});

const roleOptions = (backendConfig.entities.User.properties.role.enum || []).map(role => ({
    label: role,
    value: role,
}));

// --- COMPONENTS ---

function UserProfileSkeleton() {
  return (
    <div className="space-y-8 p-4 md:p-8">
      <header>
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-4 w-1/3 mt-2" />
      </header>
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-1/4" />
          <Skeleton className="h-4 w-1/2 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function NotAuthenticated() {
  return (
    <Card className="flex flex-col items-center justify-center text-center p-8 gap-4">
      <ShieldAlert className="h-16 w-16 text-destructive" />
      <CardTitle>Authentication Required</CardTitle>
      <CardContent>
        <p className="text-muted-foreground">
          You must be logged in to view your profile.
        </p>
      </CardContent>
    </Card>
  );
}

function ProfileDetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm py-2 border-b">
      <span className="font-semibold text-muted-foreground w-48 shrink-0">
        {label}:
      </span>
      <span className="flex-1 break-words">
        {value || <span className="text-muted-foreground/70">Not set</span>}
      </span>
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { toast } = useToast();
  
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Modals state
  const [isOfficialModalOpen, setIsOfficialModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // 1. Fetch User being viewed
  const userRef = useMemoFirebase(
    () => (id ? doc(firestore, 'users', id) : null),
    [firestore, id]
  );
  const { data: userData, isLoading: userDataLoading } = useDoc<User>(userRef);

  // 2. Fetch global client data associated with this user
  const clientRef = useMemoFirebase(
    () => (userData?.clientId ? doc(firestore, 'clients', userData.clientId) : null),
    [firestore, userData?.clientId]
  );
  const { data: clientData, isLoading: clientLoading } = useDoc<Client>(clientRef);

  // 3. Fetch Viewer's data for role checks
  const viewerRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: viewerData } = useDoc<User>(viewerRef);

  // 4. Fetch All Clients (for Admin dropdown)
  const clientsQuery = useMemoFirebase(
    () => query(collection(firestore, 'clients'), orderBy('companyName', 'asc')),
    [firestore]
  );
  const { data: allClients } = useCollection<Client>(clientsQuery);

  const isLoading = isUserLoading || userDataLoading;

  // RBAC Helpers
  const isAdmin = useMemo(() => {
    return viewerData?.role === 'Admin' || viewerData?.role === 'Superadmin';
  }, [viewerData]);

  const isOwner = useMemo(() => {
    return user?.uid === id;
  }, [user, id]);

  const canEdit = isOwner || isAdmin;

  const canViewSla = useMemo(() => {
    if (isAdmin) return true;
    const managementRoles = ['Client Manager', 'Corporate Manager', 'Services Manager', 'Site Supervisor'];
    return managementRoles.includes(viewerData?.role || '');
  }, [viewerData, isAdmin]);

  // Forms
  const officialForm = useForm<z.infer<typeof officialInfoSchema>>({
    resolver: zodResolver(officialInfoSchema),
    defaultValues: {
      name: '',
      email: '',
      sapNumber: '',
      qualifications: '',
      role: '',
      clientId: '',
    },
  });

  const contactForm = useForm<z.infer<typeof contactInfoSchema>>({
    resolver: zodResolver(contactInfoSchema),
    defaultValues: {
      phoneNumber: '',
      address: '',
      nextOfKinName: '',
      nextOfKinPhone: '',
    },
  });

  // Sync forms when data loads
  useEffect(() => {
    if (userData) {
      officialForm.reset({
        name: userData.name || '',
        email: userData.email || '',
        sapNumber: userData.sapNumber || '',
        qualifications: userData.qualifications || '',
        role: userData.role || '',
        clientId: userData.clientId || '',
      });
      contactForm.reset({
        phoneNumber: userData.phoneNumber || '',
        address: userData.address || '',
        nextOfKinName: userData.nextOfKinName || '',
        nextOfKinPhone: userData.nextOfKinPhone || '',
      });
    }
  }, [userData, officialForm, contactForm]);

  const handleSaveOfficial = async (values: z.infer<typeof officialInfoSchema>) => {
    if (!userRef) return;
    try {
      updateDocumentNonBlocking(userRef, {
        ...values,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: "Profile Updated", description: "Official information saved successfully." });
      setIsOfficialModalOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Update Failed", description: e.message });
    }
  };

  const handleSaveContact = async (values: z.infer<typeof contactInfoSchema>) => {
    if (!userRef) return;
    try {
      updateDocumentNonBlocking(userRef, {
        ...values,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: "Profile Updated", description: "Contact information saved successfully." });
      setIsContactModalOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Update Failed", description: e.message });
    }
  };

  // Date Formatter
  const formatDateSafe = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Intl.DateTimeFormat('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const contractPeriod = useMemo(() => {
    const start = formatDateSafe(clientData?.contractStartDate);
    const end = formatDateSafe(clientData?.contractEndDate);
    if (start && end) return `${start} - ${end}`;
    return 'Dates not set';
  }, [clientData]);

  if (isLoading) {
    return <UserProfileSkeleton />;
  }

  if (!user) {
    return <NotAuthenticated />;
  }

  if (!userData) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{userData.name}'s Profile</h1>
        <p className="text-muted-foreground text-sm">
          Detailed personnel and site assignment documentation.
        </p>
      </header>

      {/* SECTION 1: OFFICIAL INFORMATION */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Official Information</CardTitle>
          {canEdit && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => setIsOfficialModalOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileDetailRow label="Name" value={userData?.name} />
          <ProfileDetailRow
            label="Email"
            value={userData?.email}
          />
          <ProfileDetailRow
            label="Role"
            value={
              userData && (
                <Badge
                  variant={
                    userData.role?.includes('Admin') ||
                    userData.role?.includes('Super')
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {userData.role}
                </Badge>
              )
            }
          />
          <ProfileDetailRow label="Company / Client" value={
            clientLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 
            clientData ? (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-bold">{clientData.companyName}</span>
              </div>
            ) : <span className="text-muted-foreground italic">No Client Assigned</span>
          } />
          <ProfileDetailRow label="SAP Number" value={userData?.sapNumber} />
          <ProfileDetailRow
            label="Qualifications"
            value={userData?.qualifications}
          />
        </CardContent>
      </Card>

      {/* SECTION 2: CONTACT & EMERGENCY INFORMATION */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Contact & Emergency Information</CardTitle>
          {canEdit && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => setIsContactModalOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
            <ProfileDetailRow label="Phone Number" value={userData?.phoneNumber} />
            <ProfileDetailRow label="Home Address" value={userData?.address} />
            <ProfileDetailRow label="Next of Kin Name" value={userData?.nextOfKinName} />
            <ProfileDetailRow label="Next of Kin Phone" value={userData?.nextOfKinPhone} />
        </CardContent>
      </Card>

      {/* SECTION 3: CLIENT/CONTRACT INFORMATION - SINGLE SOURCE OF TRUTH */}
      <Card className="border-primary/10 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 rounded-t-lg border-b mb-6">
          <div>
            <CardTitle className="text-lg">Client/Contract Information</CardTitle>
            <CardDescription className="font-medium text-primary">
              Contract Period: {contractPeriod}
            </CardDescription>
          </div>
          {isAdmin && (
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/5"
              onClick={() => router.push('/admin/clients')}
              title="Manage Client Data"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileDetailRow 
            label="SLA Contract Number" 
            value={clientLoading ? "Loading..." : (clientData?.slaContractNumber || "Not specified")} 
          />
          <ProfileDetailRow 
            label="Designated Leader" 
            value={clientLoading ? "Loading..." : (clientData?.designatedLeader || "Not assigned")} 
          />
          <ProfileDetailRow 
            label="Responsible Manager" 
            value={clientLoading ? "Loading..." : (clientData?.responsibleManager || "Not assigned")} 
          />
          <ProfileDetailRow 
            label="Department" 
            value={clientLoading ? "Loading..." : (clientData?.department || "Not defined")} 
          />
          <ProfileDetailRow 
            label="Section" 
            value={clientLoading ? "Loading..." : (clientData?.section || "Not defined")} 
          />
          <ProfileDetailRow 
            label="Justification" 
            value={clientLoading ? "Loading..." : (clientData?.justification || "No justification provided")} 
          />
          
          {/* RBAC Protected Document Row */}
          {canViewSla && (
            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 text-sm py-4 border-t-2 border-slate-100 bg-emerald-50/20 px-2 rounded-b-md mt-4">
              <span className="font-bold text-emerald-800 w-48 shrink-0 flex items-center gap-2">
                <FileText className="h-4 w-4" /> SLA Agreement:
              </span>
              <span className="flex-1">
                {clientData?.slaUrl ? (
                  <a 
                    href={clientData.slaUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center text-emerald-600 font-black hover:underline gap-1 bg-white px-3 py-1.5 rounded border border-emerald-200 shadow-sm"
                  >
                    View Registered PDF <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-slate-400 italic">No document uploaded to client registry</span>
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- MODALS --- */}

      {/* 1. OFFICIAL INFO MODAL */}
      <Dialog open={isOfficialModalOpen} onOpenChange={setIsOfficialModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Official Information</DialogTitle>
            <DialogDescription>Update core personnel data and credentials.</DialogDescription>
          </DialogHeader>
          <Form {...officialForm}>
            <form onSubmit={officialForm.handleSubmit(handleSaveOfficial)} className="space-y-4 py-4">
              <FormField control={officialForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={officialForm.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={officialForm.control} name="sapNumber" render={({ field }) => (
                <FormItem><FormLabel>SAP Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={officialForm.control} name="qualifications" render={({ field }) => (
                <FormItem><FormLabel>Qualifications</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              {/* ADMIN ONLY FIELDS */}
              <FormField control={officialForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(!isAdmin && "opacity-50")}>Role (Admin Only)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isAdmin}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {roleOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!isAdmin && <p className="text-[10px] text-muted-foreground italic">Contact an administrator to change your role.</p>}
                </FormItem>
              )} />

              <FormField control={officialForm.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(!isAdmin && "opacity-50")}>Company / Client (Admin Only)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isAdmin}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select company..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Client Assigned</SelectItem>
                      {allClients?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <DialogFooter className="pt-4">
                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 2. CONTACT INFO MODAL */}
      <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Contact Information</DialogTitle>
            <DialogDescription>Manage your phone number, address, and emergency contacts.</DialogDescription>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(handleSaveContact)} className="space-y-4 py-4">
              <FormField control={contactForm.control} name="phoneNumber" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={contactForm.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Home Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={contactForm.control} name="nextOfKinName" render={({ field }) => (
                  <FormItem><FormLabel>NoK Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={contactForm.control} name="nextOfKinPhone" render={({ field }) => (
                  <FormItem><FormLabel>NoK Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
