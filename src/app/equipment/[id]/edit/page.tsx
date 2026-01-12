
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Loader2, ArrowLeft } from 'lucide-react';
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser, setDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import React, { useEffect } from 'react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useParams, useRouter, notFound } from 'next/navigation';
import type { Equipment, User, VSD } from '@/lib/types';
import backendConfig from '@/docs/backend.json';
import { Combobox } from '@/components/ui/combobox';


const formSchema = z.object({
  equipmentName: z.string().min(1, 'Equipment name is required'),
  plant: z.enum(['Mining', 'Smelter']),
  division: z.enum(["Boosters", "Dredgers", "Pump Stations"]).optional(),
  location: z.string().min(1, 'Location is required'),
  imageUrl: z.string().optional(),
  pumpHead: z.coerce.number().optional(),
  flowRate: z.coerce.number().optional(),
  
  // VSD fields
  model: z.string().min(1, 'VSD Model is required'),
  serialNumber: z.string().min(1, 'VSD Serial number is required'),
  installationDate: z.date({
    required_error: "An installation date is required.",
  }),
  assignedToId: z.string().optional(),
});

const dredgerLocations = ['MPA','MPC','MPD','MPE', "MPC DRY MINING", "Tailings Booster Pumps", "Concentrator Booster Pumps", "Smelter Area 1", "Smelter Area 2", "RWBS"];

export default function EditEquipmentPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  const eqRef = useMemoFirebase(() => (id ? doc(firestore, 'equipment', id) : null), [firestore, id]);
  const { data: eq, isLoading: eqLoading, error: eqError } = useDoc<Equipment>(eqRef);
  
  const vsdRef = useMemoFirebase(() => (eq ? doc(firestore, 'vsds', eq.vsdId) : null), [firestore, eq]);
  const { data: vsd, isLoading: vsdLoading } = useDoc<VSD>(vsdRef);

  const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    // Default values are set here, but will be overwritten by the useEffect below
    defaultValues: {
        plant: 'Mining',
        division: undefined,
    },
  });

  useEffect(() => {
    // This effect now correctly populates the entire form once data is loaded.
    if (eq && vsd) {
      form.reset({
        equipmentName: eq.name,
        plant: eq.plant,
        division: eq.division, // This is the crucial line for division
        location: eq.location,
        imageUrl: eq.imageUrl || '',
        pumpHead: eq.pumpHead ?? undefined,
        flowRate: eq.flowRate ?? undefined,
        model: vsd.model || '',
        serialNumber: vsd.serialNumber || '',
        installationDate: vsd.installationDate ? parseISO(vsd.installationDate) : new Date(),
        assignedToId: vsd.assignedToId || 'unassigned',
      });
    }
  }, [eq, vsd, form]);


  const watchedPlant = useWatch({
    control: form.control,
    name: 'plant',
  });
  
  const watchedDivision = useWatch({
    control: form.control,
    name: 'division',
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!eqRef || !vsdRef) {
        toast({ variant: 'destructive', title: 'Error', description: 'Equipment or VSD data not loaded.' });
        return;
    }

    if (values.plant === 'Mining' && !values.division) {
        form.setError('division', { type: 'manual', message: 'Please select a division for the Mining plant.' });
        return;
    }
    
    const assignedUser = users?.find(u => u.id === values.assignedToId);

    // This data object now correctly includes all fields from the form
    const equipmentUpdateData: Partial<Equipment> = {
      name: values.equipmentName,
      plant: values.plant,
      division: values.division, // This ensures the division is saved
      location: values.location,
      imageUrl: values.imageUrl,
      pumpHead: values.pumpHead || 0,
      flowRate: values.flowRate || 0,
    };
    
    if (values.plant !== 'Mining') {
        equipmentUpdateData.division = undefined;
    }


    const vsdUpdateData: Partial<VSD> = {
        model: values.model,
        serialNumber: values.serialNumber,
        installationDate: format(values.installationDate, "yyyy-MM-dd"),
        assignedToId: values.assignedToId === 'unassigned' ? '' : values.assignedToId,
        assignedToName: values.assignedToId === 'unassigned' ? '' : (assignedUser?.name || ''),
    };


    updateDocumentNonBlocking(eqRef, equipmentUpdateData);
    setDocumentNonBlocking(vsdRef, vsdUpdateData, { merge: true });

    toast({
      title: 'Equipment Updated',
      description: `${values.equipmentName} has been successfully updated.`,
    });
    router.push(`/equipment/${id}`);
  }

  if (eqLoading || vsdLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-2">Loading equipment data...</p>
        </div>
    )
  }

  if (!eq) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Equipment: {eq.name}</h1>
            <p className="text-muted-foreground">
            Update the details for this piece of equipment.
            </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
        </Button>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
                <CardHeader>
                <CardTitle>Equipment Details</CardTitle>
                <CardDescription>This VSD controls the equipment with the ID: <strong>{id}</strong>.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                <FormField
                    control={form.control}
                    name="equipmentName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Equipment Name</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Coolant Pump B" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="plant"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Plant</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                        <Select onValueChange={field.onChange} value={field.value}>
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
                {watchedPlant === 'Mining' && watchedDivision ? (
                    <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Location (Plant Heading)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                            <Input placeholder="e.g., Sector C, Line 2" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}
                 <FormField
                    control={form.control}
                    name="pumpHead"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Pump Head (m)</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="e.g., 50" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="flowRate"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Flow Rate (m³/h)</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="e.g., 120" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="md:col-span-2">
                    <FormField
                        control={form.control}
                        name="imageUrl"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Image</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Select an image for the equipment" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {PlaceHolderImages.map(img => <SelectItem key={img.id} value={img.imageUrl}>{img.description}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>VSD Information</CardTitle>
                    <CardDescription>Details for the Variable Speed Drive controlling this equipment.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>VSD Model</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Altek Drive 5000" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="serialNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>VSD Serial Number</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., SN-A1B2-C3D4" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="installationDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Installation Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                    format(field.value, "PPP")
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="assignedToId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Assigned VSD Technician</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Assign a technician..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {usersLoading ? (
                                        <SelectItem value="loading" disabled>Loading users...</SelectItem>
                                    ) : (
                                        <>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Back</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

    