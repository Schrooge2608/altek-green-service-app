
'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Equipment, User as AppUser } from '@/lib/types';
import { Loader2, Pencil, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  name: z.string().min(1, 'Equipment name is required'),
  plant: z.enum(['Mining', 'Smelter']),
  division: z.enum(["Boosters", "Dredgers", "Pump Stations"]).optional(),
  location: z.string().min(1, 'Location is required'),
});

const dredgerLocations = ['MPA','MPC','MPD','MPE', "MPC DRY MINING"];

function AccessDenied() {
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 gap-4">
            <ShieldAlert className="h-16 w-16 text-destructive" />
            <CardTitle>Access Denied</CardTitle>
            <CardContent>
                <p className="text-muted-foreground">You do not have permission to edit this page. Please contact an administrator.</p>
            </CardContent>
        </Card>
    );
}

export default function EditEquipmentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = typeof params.id === 'string' ? params.id : '';
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [isEditing, setIsEditing] = useState(false);

  const eqRef = useMemoFirebase(() => (id ? doc(firestore, 'equipment', id) : null), [firestore, id]);
  const { data: eq, isLoading: eqLoading } = useDoc<Equipment>(eqRef);

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData, isLoading: userLoading } = useDoc<AppUser>(userRoleRef);
  const isKnownAdmin = userData?.role && (userData.role.includes('Admin') || userData.role.includes('Superadmin'));

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      plant: 'Mining',
    },
  });

  const watchedPlant = useWatch({ control: form.control, name: 'plant' });
  const watchedDivision = useWatch({ control: form.control, name: 'division' });

  useEffect(() => {
    if (eq) {
      form.reset({
        name: eq.name,
        plant: eq.plant,
        division: eq.division,
        location: eq.location,
      });
    }
  }, [eq, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!eqRef) return;
    
    if (values.plant === 'Mining' && !values.division) {
        form.setError('division', { type: 'manual', message: 'Please select a division for the Mining plant.' });
        return;
    }

    const updateData: Partial<Equipment> = {
        name: values.name,
        plant: values.plant,
        division: values.division,
        location: values.location,
    };

    updateDocumentNonBlocking(eqRef, updateData);

    toast({
      title: 'Equipment Updated',
      description: `${values.name} has been successfully updated.`,
    });
    setIsEditing(false);
  }
  
  const isLoading = eqLoading || userLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="ml-2">Loading...</p>
      </div>
    );
  }

  if (!isKnownAdmin) {
      return <AccessDenied />;
  }

  if (!eq) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Edit Equipment: {eq.name}</h1>
        <p className="text-muted-foreground">
          Update the details for the selected equipment cluster.
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Equipment Details</CardTitle>
                    <CardDescription>Update information about the main equipment unit.</CardDescription>
                </div>
                {!isEditing && (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>
                )}
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Equipment Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Coolant Pump B" {...field} disabled={!isEditing} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormItem>
                    <FormLabel>Equipment ID (Read-only)</FormLabel>
                    <Input readOnly disabled value={eq.id} />
                </FormItem>
                <FormField
                  control={form.control}
                  name="plant"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plant</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a plant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Mining">Mining</SelectItem>
                          <SelectItem value="Smelter">Smelter</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              {watchedPlant === 'Mining' && (
                <FormField
                  control={form.control}
                  name="division"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Division</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a division" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Boosters">Boosters</SelectItem>
                          <SelectItem value="Dredgers">Dredgers</SelectItem>
                          <SelectItem value="Pump Stations">Pump Stations</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
               {watchedPlant === 'Mining' && watchedDivision === 'Dredgers' ? (
                 <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Plant Heading)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dredgerLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
               ) : (
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Sector C, Line 2" {...field} disabled={!isEditing} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

           {isEditing && (
             <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => {
                    setIsEditing(false);
                    form.reset({
                        name: eq.name,
                        plant: eq.plant,
                        division: eq.division,
                        location: eq.location,
                    });
                }}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </div>
           )}
        </form>
      </Form>
    </div>
  );
}
