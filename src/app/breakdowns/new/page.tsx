
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from 'lucide-react';
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Equipment, VSD, Breakdown } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';


const formSchema = z.object({
  equipmentId: z.string().min(1, 'Please select an equipment cluster.'),
  component: z.string().min(1, 'Please select the failed component.'),
  date: z.date({
    required_error: "A breakdown date is required.",
  }),
  description: z.string().min(10, 'Please provide a detailed description of the issue.').max(500),
});


export default function NewBreakdownPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const equipmentIdFromQuery = searchParams.get('equipmentId');
  
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipmentList, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipmentId: equipmentIdFromQuery || '',
      component: '',
      description: '',
    },
  });

  useEffect(() => {
    if (equipmentIdFromQuery) {
        form.setValue('equipmentId', equipmentIdFromQuery);
    }
  }, [equipmentIdFromQuery, form]);

  const watchedEquipmentId = useWatch({
    control: form.control,
    name: 'equipmentId',
  });

  const selectedEquipment = React.useMemo(() => {
    return equipmentList?.find(e => e.id === watchedEquipmentId);
  }, [watchedEquipmentId, equipmentList]);

  const vsdRef = useMemoFirebase(() => (selectedEquipment ? doc(firestore, 'vsds', selectedEquipment.vsdId) : null), [firestore, selectedEquipment]);
  const { data: vsd, isLoading: vsdLoading } = useDoc<VSD>(vsdRef);

  const componentOptions = React.useMemo(() => {
    if (!selectedEquipment || !vsd) return [];
    
    const options = [];
    if (vsd.model) options.push({ value: `VSD::${vsd.model}::${vsd.serialNumber}`, label: `VSD: ${vsd.model} (SN: ${vsd.serialNumber})`});
    if (selectedEquipment.breakerAssetNumber) options.push({ value: `Protection::${selectedEquipment.breakerType || 'Breaker'}::${selectedEquipment.breakerAssetNumber}`, label: `Protection: ${selectedEquipment.breakerAssetNumber}` });
    if (selectedEquipment.motorModel) options.push({ value: `Motor::${selectedEquipment.motorModel}::${selectedEquipment.motorSerialNumber}`, label: `Motor: ${selectedEquipment.motorModel} (SN: ${selectedEquipment.motorSerialNumber})` });
    if (selectedEquipment.pumpBrand) options.push({ value: `Pump::${selectedEquipment.pumpBrand}::${selectedEquipment.pumpSerialNumber}`, label: `Pump: ${selectedEquipment.pumpBrand} (SN: ${selectedEquipment.pumpSerialNumber})` });
    if (selectedEquipment.upsModel) options.push({ value: `UPS::${selectedEquipment.upsModel}::${selectedEquipment.upsSerialNumber}`, label: `UPS: ${selectedEquipment.upsModel} (SN: ${selectedEquipment.upsSerialNumber})` });
    options.push({ value: 'Other', label: 'Other/Not Listed' });

    return options;
  }, [selectedEquipment, vsd]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedEquipment) {
        toast({
          variant: "destructive",
          title: 'Invalid Equipment',
          description: `Could not find the selected equipment.`,
        });
        return;
    }

    const breakdownRef = collection(firestore, 'breakdown_reports');

    const breakdownData: Omit<Breakdown, 'id'> = {
      equipmentId: values.equipmentId,
      equipmentName: selectedEquipment.name,
      component: values.component.split('::')[0] as Breakdown['component'], // Store only component type
      date: format(values.date, "yyyy-MM-dd"),
      description: values.description,
      resolved: false,
      timeReported: new Date().toISOString(),
    };

    addDocumentNonBlocking(breakdownRef, breakdownData);
    
    // Update the equipment status
    const equipmentRef = doc(firestore, 'equipment', values.equipmentId);
    updateDocumentNonBlocking(equipmentRef, { breakdownStatus: 'Active' });

    toast({
      title: 'Breakdown Reported',
      description: `The issue for ${selectedEquipment.name} (${values.component}) has been logged.`,
    });
    router.push(`/equipment/${values.equipmentId}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Report New Breakdown</h1>
        <p className="text-muted-foreground">
          Log an equipment failure or issue for immediate attention.
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Breakdown Details</CardTitle>
              <CardDescription>Select the equipment cluster, then pinpoint the failed component.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Cluster</FormLabel>
                    {equipmentIdFromQuery && selectedEquipment ? (
                        <FormControl>
                            <Input value={`${selectedEquipment.name} (${selectedEquipment.location})`} disabled />
                        </FormControl>
                    ) : (
                        <Select onValueChange={field.onChange} value={field.value} disabled={equipmentLoading}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select the equipment cluster..." />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {equipmentLoading ? (
                                    <SelectItem value="loading" disabled>Loading equipment...</SelectItem>
                                ) : (
                                    equipmentList?.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.location})</SelectItem>)
                                )}
                            </SelectContent>
                        </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="component"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Failed Component</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!watchedEquipmentId || vsdLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select the specific component..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vsdLoading ? (
                             <SelectItem value="loading" disabled>Loading components...</SelectItem>
                        ) : componentOptions.length > 0 ? (
                            componentOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)
                        ) : (
                            <SelectItem value="none" disabled>Select an equipment cluster first</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Breakdown</FormLabel>
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
                            date > new Date() || date < new Date("2020-01-01")
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
                    name="description"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description of Issue</FormLabel>
                        <FormControl>
                        <Textarea
                            placeholder="Describe what went wrong, any error codes, or unusual behavior."
                            className="resize-none"
                            {...field}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" variant="destructive">Submit Report</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
