
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
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Combobox } from '@/components/ui/combobox';
import React, { useMemo, useEffect } from 'react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useParams, useRouter, notFound } from 'next/navigation';
import type { Equipment, VSD, User } from '@/lib/types';


const formSchema = z.object({
  serialNumber: z.string().min(1, 'Serial number is required'),
  model: z.string().min(1, 'Model is required'),
  installationDate: z.date({
    required_error: "An installation date is required.",
  }),
  equipmentName: z.string().min(1, 'Equipment name is required'),
  equipmentType: z.string().min(1, 'Equipment type is required.'),
  plant: z.enum(['Mining', 'Smelter']),
  division: z.enum(["Boosters"]).optional(),
  location: z.string().min(1, 'Location is required'),
  imageUrl: z.string().optional(),
  motorModel: z.string().optional(),
  motorPower: z.coerce.number().optional(),
  motorVoltage: z.coerce.number().optional(),
  motorSerialNumber: z.string().optional(),
  assignedToMotorId: z.string().optional(),
  breakerModel: z.string().optional(),
  breakerAmperage: z.coerce.number().optional(),
  breakerLocation: z.string().optional(),
  assignedToProtectionId: z.string().optional(),
  assignedToId: z.string().optional(),
});

const boosterLocations = ['MPA','MPC','MPD','MPE', 'TAILS BOOSTERS','CONS BOOSTERS','MPC DRY MINING', 'HLABANE', 'RETURN WATER BOOSTER STATION'];

const initialEquipmentTypes = [
  { value: "Pump", label: "Pump" },
  { value: "Fan", label: "Fan" },
  { value: "Compressor", label: "Compressor" },
  { value: "Utility Room", label: "Utility Room" },
];

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
  const { data: vsd, isLoading: vsdLoading, error: vsdError } = useDoc<VSD>(vsdRef);
  
  const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const equipmentTypes = useMemo(() => initialEquipmentTypes, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        serialNumber: '',
        model: '',
        equipmentName: '',
        equipmentType: '',
        location: '',
        imageUrl: '',
        motorModel: '',
        motorPower: undefined,
        motorVoltage: undefined,
        motorSerialNumber: '',
        breakerModel: '',
        breakerAmperage: undefined,
        breakerLocation: '',
        assignedToId: 'unassigned',
        assignedToMotorId: 'unassigned',
        assignedToProtectionId: 'unassigned',
    },
  });

  useEffect(() => {
    if (eq && vsd) {
      form.reset({
        serialNumber: vsd.serialNumber || '',
        model: vsd.model || '',
        installationDate: vsd.installationDate ? parseISO(vsd.installationDate) : new Date(),
        equipmentName: eq.name,
        equipmentType: eq.type,
        plant: eq.plant,
        division: eq.division,
        location: eq.location,
        imageUrl: eq.imageUrl || '',
        motorModel: eq.motorModel || '',
        motorPower: eq.motorPower ?? undefined,
        motorVoltage: eq.motorVoltage ?? undefined,
        motorSerialNumber: eq.motorSerialNumber || '',
        assignedToMotorId: eq.motorAssignedToId || 'unassigned',
        breakerModel: eq.breakerModel || '',
        breakerAmperage: eq.breakerAmperage ?? undefined,
        breakerLocation: eq.breakerLocation || '',
        assignedToProtectionId: eq.protectionAssignedToId || 'unassigned',
        assignedToId: eq.assignedToId || 'unassigned',
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
    if (!eq || !vsdRef) {
        toast({ variant: 'destructive', title: 'Error', description: 'Equipment or VSD data not loaded.' });
        return;
    }

    if (values.plant === 'Mining' && !values.division) {
        form.setError('division', { type: 'manual', message: 'Please select a division for the Mining plant.' });
        return;
    }
    
    const assignedUser = users?.find(u => u.id === values.assignedToId);
    const motorUser = users?.find(u => u.id === values.assignedToMotorId);
    const protectionUser = users?.find(u => u.id === values.assignedToProtectionId);

    const vsdUpdateData: Partial<VSD> = {
        serialNumber: values.serialNumber,
        model: values.model,
        installationDate: format(values.installationDate, "yyyy-MM-dd"),
    };
    updateDocumentNonBlocking(vsdRef, vsdUpdateData);
    
    const equipmentUpdateData: Partial<Equipment> = {
      name: values.equipmentName,
      type: values.equipmentType as any,
      plant: values.plant,
      location: values.location,
      imageUrl: values.imageUrl,
      motorModel: values.motorModel || '',
      motorPower: values.motorPower || 0,
      motorVoltage: values.motorVoltage || 0,
      motorSerialNumber: values.motorSerialNumber || '',
      motorAssignedToId: values.assignedToMotorId === 'unassigned' ? '' : values.assignedToMotorId,
      motorAssignedToName: values.assignedToMotorId === 'unassigned' ? '' : (motorUser?.name || ''),
      breakerModel: values.breakerModel || '',
      breakerAmperage: values.breakerAmperage || 0,
      breakerLocation: values.breakerLocation || '',
      protectionAssignedToId: values.assignedToProtectionId === 'unassigned' ? '' : values.assignedToProtectionId,
      protectionAssignedToName: values.assignedToProtectionId === 'unassigned' ? '' : (protectionUser?.name || ''),
      assignedToId: values.assignedToId === 'unassigned' ? '' : values.assignedToId,
      assignedToName: values.assignedToId === 'unassigned' ? '' : (assignedUser?.name || ''),
    };

    if (values.plant === 'Mining') {
        equipmentUpdateData.division = values.division;
    } else {
        equipmentUpdateData.division = undefined;
    }

    updateDocumentNonBlocking(eqRef, equipmentUpdateData);

    toast({
      title: 'Equipment Updated',
      description: `${values.equipmentName} has been successfully updated.`,
    });
    router.push(`/equipment/${id}`);
  }

  if (eqLoading) {
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
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Edit Equipment: {eq.name}</h1>
        <p className="text-muted-foreground">
          Update the details for this piece of equipment.
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>VSD Information</CardTitle>
              <CardDescription>Details of the Variable Speed Drive associated with the equipment.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                {vsdLoading ? <p>Loading VSD data...</p> : (
                    <>
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
                    </>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>Protection Details (Circuit Breaker)</CardTitle>
                <CardDescription>Information about the equipment's circuit breaker.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                <FormField
                    control={form.control}
                    name="breakerModel"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Breaker Model</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Schneider GV2ME" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="breakerAmperage"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Amperage (A)</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="e.g., 63" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="breakerLocation"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Breaker Location</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., MCC-01 Panel 3" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="assignedToProtectionId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Assigned Protection Technician</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Assign a protection technician..." />
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

          <Card>
            <CardHeader>
                <CardTitle>Motor Details</CardTitle>
                <CardDescription>Information about the motor driven by the VSD.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                <FormField
                    control={form.control}
                    name="motorModel"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Motor Model</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., WEG W22" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="motorSerialNumber"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Motor Serial Number</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., MOT-SN-12345" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="motorPower"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Power (kW)</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="e.g., 75" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="motorVoltage"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Voltage (V)</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="e.g., 400" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="assignedToMotorId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Assigned Motor Technician</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Assign a motor technician..." />
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
          
          <Card>
            <CardHeader>
              <CardTitle>Driven Equipment Details</CardTitle>
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
                name="equipmentType"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Equipment Type</FormLabel>
                    <Combobox
                        options={equipmentTypes}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select or create type..."
                        searchPlaceholder='Search types...'
                        noResultsMessage='No types found.'
                    />
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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
               {watchedPlant === 'Mining' && (watchedDivision === 'Boosters') ? (
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
                          {boosterLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
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
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Technician (Overall)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Assign a primary technician..." />
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
