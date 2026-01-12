
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
import { CalendarIcon } from 'lucide-react';
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { User, Equipment, VSD } from '@/lib/types';
import backendConfig from '@/docs/backend.json';
import { Combobox } from '@/components/ui/combobox';


const formSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  equipmentName: z.string().min(1, 'Equipment name is required'),
  plant: z.enum(['Mining', 'Smelter']),
  division: z.enum(["Boosters", "Dredgers", "Pump Stations"]).optional(),
  location: z.string().min(1, 'Location is required'),
  imageUrl: z.string().optional(),
  
  // VSD fields
  vsdId: z.string().min(1, 'VSD ID is required'),
  model: z.string().min(1, 'VSD Model is required'),
  serialNumber: z.string().min(1, 'VSD Serial number is required'),
  installationDate: z.date({
    required_error: "An installation date is required.",
  }),
  assignedToId: z.string().optional(),

  // Protection fields
  breakerModel: z.string().optional(),
  breakerAmperage: z.coerce.number().optional(),
  breakerLocation: z.string().optional(),
  protectionAssignedToId: z.string().optional(),
});

const dredgerLocations = ['MPA','MPC','MPD','MPE', "MPC DRY MINING"];

export default function NewEquipmentPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipmentId: '',
      equipmentName: '',
      location: '',
      imageUrl: '',
      vsdId: '',
      serialNumber: '',
      model: '',
    },
  });

  const watchedPlant = useWatch({
    control: form.control,
    name: 'plant',
  });
  
  const watchedDivision = useWatch({
    control: form.control,
    name: 'division',
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.plant === 'Mining' && !values.division) {
        form.setError('division', { type: 'manual', message: 'Please select a division for the Mining plant.' });
        return;
    }
    
    const assignedUser = users?.find(u => u.id === values.assignedToId);
    const protectionAssignedUser = users?.find(u => u.id === values.protectionAssignedToId);

    const equipmentRef = doc(firestore, 'equipment', values.equipmentId);
    const vsdRef = doc(firestore, 'vsds', values.vsdId);

    const equipmentData: Omit<Equipment, 'status' | 'model' | 'serialNumber' | 'installationDate'> = {
      id: values.equipmentId,
      name: values.equipmentName,
      plant: values.plant,
      vsdId: values.vsdId,
      location: values.location,
      imageUrl: values.imageUrl,
      lastMaintenance: format(new Date(), "yyyy-MM-dd"),
      nextMaintenance: format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd"),
      uptime: 100,
      powerConsumption: 0,
      totalDowntimeHours: 0,
      breakerModel: values.breakerModel,
      breakerAmperage: values.breakerAmperage,
      breakerLocation: values.breakerLocation,
      protectionAssignedToId: values.protectionAssignedToId,
      protectionAssignedToName: protectionAssignedUser?.name,
    };

    if (values.plant === 'Mining') {
        equipmentData.division = values.division;
    }

    const vsdData: VSD = {
        id: values.vsdId,
        equipmentId: values.equipmentId,
        model: values.model,
        serialNumber: values.serialNumber,
        installationDate: format(values.installationDate, "yyyy-MM-dd"),
        status: 'active',
        assignedToId: values.assignedToId || '',
        assignedToName: assignedUser?.name || '',
    };

    setDocumentNonBlocking(equipmentRef, equipmentData, { merge: true });
    setDocumentNonBlocking(vsdRef, vsdData, { merge: true });

    toast({
      title: 'Equipment Added',
      description: `Equipment ${values.equipmentName} has been successfully added.`,
    });
    form.reset();
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Add New Equipment</h1>
        <p className="text-muted-foreground">
          Capture data for a new equipment cluster.
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
           <Card>
            <CardHeader>
              <CardTitle>Equipment Details</CardTitle>
              <CardDescription>Information about the main equipment unit.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., pump-003" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              <div className="md:col-span-2">
                <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Image</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <CardTitle>Protection Details</CardTitle>
                <CardDescription>Circuit breaker or vacuum breaker information.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                <FormField
                    control={form.control}
                    name="breakerModel"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Breaker Model</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Siemens 3RV" {...field} value={field.value ?? ''} />
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
                        <FormLabel>Breaker Amperage (A)</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="e.g., 100" {...field} value={field.value ?? ''} />
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
                        <Input placeholder="e.g., Panel PP-01" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="protectionAssignedToId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Assigned Protection Technician</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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

          <Card>
            <CardHeader>
                <CardTitle>VSD Information</CardTitle>
                <CardDescription>Details for the Variable Speed Drive controlling this equipment.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                <FormField
                    control={form.control}
                    name="vsdId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>VSD ID</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., vsd-001" {...field} />
                        </FormControl>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            </CardContent>
          </Card>

          
          <div className="flex justify-end">
            <Button type="submit">Save Equipment</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
