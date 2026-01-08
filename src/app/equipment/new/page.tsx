
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
import { useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const formSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  equipmentName: z.string().min(1, 'Equipment name is required'),
  plant: z.enum(['Mining', 'Smelter']),
  division: z.enum(["Boosters"]).optional(),
  location: z.string().min(1, 'Location is required'),
  imageUrl: z.string().optional(),
  
  // Merged VSD fields
  model: z.string().min(1, 'VSD Model is required'),
  serialNumber: z.string().min(1, 'VSD Serial number is required'),
  installationDate: z.date({
    required_error: "An installation date is required.",
  }),

  // Motor fields
  motorModel: z.string().optional(),
  motorPower: z.coerce.number().optional(),
  motorVoltage: z.coerce.number().optional(),
  motorSerialNumber: z.string().optional(),
  
  // Breaker fields
  breakerModel: z.string().optional(),
  breakerAmperage: z.coerce.number().optional(),
  breakerLocation: z.string().optional(),
  
  // Pump fields
  pumpModel: z.string().optional(),
  pumpSerialNumber: z.string().optional(),
  pumpHead: z.coerce.number().optional(),
  flowRate: z.coerce.number().optional(),
});

const boosterLocations = ['MPA','MPC','MPD','MPE', 'TAILS BOOSTERS','CONS BOOSTERS','MPC DRY MINING', 'HLABANE', 'RETURN WATER BOOSTER STATION'];

export default function NewEquipmentPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipmentId: '',
      equipmentName: '',
      location: '',
      imageUrl: '',
      serialNumber: '',
      model: '',
      motorModel: '',
      motorSerialNumber: '',
      breakerModel: '',
      breakerLocation: '',
      pumpModel: '',
      pumpSerialNumber: '',
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

    const equipmentRef = doc(firestore, 'equipment', values.equipmentId);

    const equipmentData: any = {
      id: values.equipmentId,
      name: values.equipmentName,
      type: 'Pump', // Defaulting to Pump
      plant: values.plant,
      location: values.location,
      imageUrl: values.imageUrl,
      
      // VSD fields now part of equipment
      model: values.model,
      serialNumber: values.serialNumber,
      installationDate: format(values.installationDate, "yyyy-MM-dd"),
      status: 'active',
      
      // Other fields
      pumpModel: values.pumpModel || '',
      pumpSerialNumber: values.pumpSerialNumber || '',
      pumpHead: values.pumpHead || 0,
      flowRate: values.flowRate || 0,
      lastMaintenance: format(new Date(), "yyyy-MM-dd"),
      nextMaintenance: format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd"),
      uptime: 100,
      powerConsumption: 0,
      totalDowntimeHours: 0,
      motorModel: values.motorModel || '',
      motorPower: values.motorPower || 0,
      motorVoltage: values.motorVoltage || 0,
      motorSerialNumber: values.motorSerialNumber || '',
      breakerModel: values.breakerModel || '',
      breakerAmperage: values.breakerAmperage || 0,
      breakerLocation: values.breakerLocation || '',
    };

    if (values.plant === 'Mining') {
        equipmentData.division = values.division;
    }

    setDocumentNonBlocking(equipmentRef, equipmentData, {});

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
              <CardTitle>Equipment Cluster Details</CardTitle>
              <CardDescription>Information about the equipment cluster and its integrated VSD.</CardDescription>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <CardTitle>Protection Details (Circuit Breaker)</CardTitle>
                <CardDescription>Information about the equipment's circuit breaker.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
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
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Pump Details</CardTitle>
              <CardDescription>Specific details for the pump component.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="pumpModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pump Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., KSB Omega 200" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pumpSerialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pump Serial Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., PMP-SN-67890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
