
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import React, { useEffect } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import type { User } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import backendConfig from '@/docs/backend.json';


const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please provide a valid email.'),
  role: z.string().min(1, 'Role is required.'),
  phoneNumber: z.string().optional(),
  address: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  sapNumber: z.string().optional(),
  qualifications: z.string().optional(),
  designatedLeaderName: z.string().optional(),
  responsibleGenManager: z.string().optional(),
  department: z.string().optional(),
  section: z.string().optional(),
  purchaseOrderNo: z.string().optional(),
  justification: z.string().optional(),
});

const roleOptions = (backendConfig.entities.User.properties.role.enum || []).map(role => ({
    label: role,
    value: role,
}));


export default function EditUserPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  const userRef = useMemoFirebase(() => (id ? doc(firestore, 'users', id) : null), [firestore, id]);
  const { data: user, isLoading: userLoading, error: userError } = useDoc<User>(userRef);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Technician',
      phoneNumber: '',
      address: '',
      nextOfKinName: '',
      nextOfKinPhone: '',
      sapNumber: '',
      qualifications: '',
      designatedLeaderName: '',
      responsibleGenManager: '',
      department: '',
      section: '',
      purchaseOrderNo: '',
      justification: '',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        nextOfKinName: user.nextOfKinName || '',
        nextOfKinPhone: user.nextOfKinPhone || '',
        sapNumber: user.sapNumber || '',
        qualifications: user.qualifications || '',
        designatedLeaderName: user.designatedLeaderName || '',
        responsibleGenManager: user.responsibleGenManager || '',
        department: user.department || '',
        section: user.section || '',
        purchaseOrderNo: user.purchaseOrderNo || '',
        justification: user.justification || '',
      });
    }
  }, [user, form]);


  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userRef) {
        toast({ variant: 'destructive', title: 'Error', description: 'User data not loaded.' });
        return;
    }
    
    // Note: Updating email in Firestore does not update it in Firebase Auth.
    // This requires a backend function for security reasons. For this UI,
    // we'll show a toast to remind the admin of this.
    if (values.email !== user?.email) {
      toast({
        title: 'Email Change Notice',
        description: "The user's sign-in email has not been changed. This must be done via the Firebase console for security.",
        duration: 7000,
      });
    }

    const updateData = {
        ...values,
    };

    updateDocumentNonBlocking(userRef, updateData);

    toast({
      title: 'User Updated',
      description: `${values.name}'s profile has been successfully updated.`,
    });
    router.push(`/admin/users`);
  }

  if (userLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Loading user data...</p>
        </div>
    )
  }

  if (!user) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Edit User: {user.name}</h1>
        <p className="text-muted-foreground">
          Update the details for this user.
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
              <CardDescription>You can change the user's name, role, and contact information here.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., john.doe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                     <Combobox
                        options={roleOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select or create a role..."
                        searchPlaceholder="Search roles..."
                        noResultsMessage="No roles found."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., +27 12 345 6789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., 123 Industrial Way, Factory Town" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
                <CardTitle>SAP &amp; Qualifications</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                 <FormField
                    control={form.control}
                    name="sapNumber"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>SAP Number</FormLabel>
                        <FormControl>
                        <Input placeholder="Enter SAP number" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="qualifications"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Qualifications</FormLabel>
                        <FormControl>
                        <Textarea placeholder="List qualifications" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>RBM Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                 <FormField control={form.control} name="designatedLeaderName" render={({ field }) => (<FormItem><FormLabel>Designated Leader Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="responsibleGenManager" render={({ field }) => (<FormItem><FormLabel>Responsible Gen Manager</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="section" render={({ field }) => (<FormItem><FormLabel>Section</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="purchaseOrderNo" render={({ field }) => (<FormItem><FormLabel>Purchase Order No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="md:col-span-2">
                    <FormField control={form.control} name="justification" render={({ field }) => (<FormItem><FormLabel>Justification</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
                <CardDescription>Next of kin information.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                 <FormField
                    control={form.control}
                    name="nextOfKinName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Next of Kin Name</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="nextOfKinPhone"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Next of Kin Phone</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., +27 98 765 4321" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
