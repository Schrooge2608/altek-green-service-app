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
import { useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Combobox } from '@/components/ui/combobox';
import { useMemo } from 'react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const formSchema = z.object({
  serialNumber: z.string().min(1, 'Serial number is required'),
  model: z.string().min(1, 'Model is required'),
  installationDate: z.date({
    required_error: "An installation date is required.",
  }),
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  equipmentName: z.string().min(1, 'Equipment name is required'),
  equipmentType: z.string().min(1, 'Equipment type is required.'),
  plant: z.enum(['Mining', 'Smelter']),
  division: z.enum(["Boosters"]).optional(),
  location: z.string().min(1, 'Location is required'),
  imageUrl: z.string().optional(),
});

const boosterLocations = ['MPA','MPC','MPD','MPE', 'TAILS BOOSTERS','CONS BOOSTERS','MPC DRY MINING', 'HLABANE', 'RETURN WATER BOOSTER STATION'];

const initialEquipmentTypes = [
  { value: "Pump", label: "Pump" },
  { value: "Fan", label: "Fan" },
  { value: "Compressor", label: "Compressor" },
  { value: "Utility Room", label: "Utility Room" },
];

export default function NewEquipmentPage() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const equipmentTypes = useMemo(() => initialEquipmentTypes, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serialNumber: '',
      model: '',
      equipmentId: '',
      equipmentName: '',
      equipmentType: '',
      location: '',
      imageUrl: '',
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

    const vsdRef = doc(collection(firestore, 'vsds'));
    const equipmentRef = doc(firestore, 'equipment', values.equipmentId);

    const vsdData = {
      id: vsdRef.id,
      serialNumber: values.serialNumber,
      model: values.model,
      installationDate: format(values.installationDate, "yyyy-MM-dd"),
      status: 'active',
      equipmentId: values.equipmentId,
    };

    const equipmentData: any = {
      id: values.equipmentId,
      name: values.equipmentName,
      type: values.equipmentType,
      plant: values.plant,
      location: values.location,
      vsdId: vsdRef.id,
      pumpHead: 0, // Default values
      flowRate: 0, // Default values
      lastMaintenance: format(new Date(), "yyyy-MM-dd"),
      nextMaintenance: format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd"),
      uptime: 100,
      powerConsumption: 0,
      imageUrl: values.imageUrl,
    };

    if (values.plant === 'Mining') {
        equipmentData.division = values.division;
    }

    setDocumentNonBlocking(vsdRef, vsdData, {});
    setDocumentNonBlocking(equipmentRef, equipmentData, {});

    toast({
      title: 'VSD & Equipment Added',
      description: `VSD with serial ${values.serialNumber} and equipment ${values.equipmentName} have been successfully added.`,
    });
    form.reset();
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Add New Equipment</h1>
        <p className="text-muted-foreground">
          Capture serial numbers, equipment IDs, and other data for new equipment.
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
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Driven Equipment Details</CardTitle>
              <CardDescription>Information about the equipment this VSD controls.</CardDescription>
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
                          </Trigger>
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

          <div className="flex justify-end">
            <Button type="submit">Save Equipment</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
