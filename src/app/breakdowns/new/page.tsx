
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
  FormDescription,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Loader2, Clock } from 'lucide-react';
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase, useDoc, updateDocumentNonBlocking, useFirebase, useUser } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Equipment, VSD, Breakdown } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { ImageUploader } from '@/components/image-uploader';
import { Switch } from '@/components/ui/switch';


const formSchema = z.object({
  equipmentId: z.string().min(1, 'Please select an equipment cluster.'),
  component: z.string().min(1, 'Please select the failed component.'),
  date: z.date({
    required_error: "A breakdown date is required.",
  }),
  description: z.string().min(10, 'Please provide a detailed description of the issue.'),
  resolved: z.boolean().default(false),
  resolution: z.string().optional(),
  timeReported: z.string().optional(),
  timeArrived: z.string().optional(),
  timeBackInService: z.string().optional(),
  timeLeftSite: z.string().optional(),
  hasDelays: z.boolean().default(false),
  delayReason: z.string().optional(),
}).refine(data => {
    if (data.resolved && (!data.resolution || data.resolution.length < 10)) {
        return false;
    }
    return true;
}, {
    message: "If the breakdown is marked as resolved, resolution notes of at least 10 characters are required.",
    path: ["resolution"],
});


export default function NewBreakdownPage() {
  const { toast } = useToast();
  const { firestore, firebaseApp } = useFirebase();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const equipmentIdFromQuery = searchParams.get('equipmentId');

  const [isSaving, setIsSaving] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipmentList, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipmentId: equipmentIdFromQuery || '',
      component: '',
      description: '',
      resolved: false,
      resolution: '',
      hasDelays: false,
      delayReason: '',
    },
  });
  
  const watchedResolved = form.watch('resolved');
  const watchedHasDelays = form.watch('hasDelays');

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

  const uploadImages = async (breakdownId: string): Promise<string[]> => {
    if (!firebaseApp || images.length === 0) return [];
    const storage = getStorage(firebaseApp);
    const uploadPromises = images.map(file => {
        const storagePath = `breakdown_reports/${breakdownId}/${file.name}_${Date.now()}`;
        const storageRef = ref(storage, storagePath);
        return uploadBytes(storageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
    });
    try {
        const urls = await Promise.all(uploadPromises);
        return urls;
    } catch (error) {
        console.error("Image upload failed:", error);
        toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload one or more images." });
        throw error;
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selectedEquipment || !user) {
        toast({
          variant: "destructive",
          title: 'Invalid Data',
          description: `Could not find the selected equipment or user.`,
        });
        return;
    }

    setIsSaving(true);
    
    const newBreakdownRef = doc(collection(firestore, 'breakdown_reports'));

    try {
        const imageUrls = await uploadImages(newBreakdownRef.id);

        const breakdownData: Partial<Breakdown> = {
          id: newBreakdownRef.id,
          userId: user.uid,
          equipmentId: values.equipmentId,
          equipmentName: selectedEquipment.name,
          component: values.component.split('::')[0] as Breakdown['component'],
          date: format(values.date, "yyyy-MM-dd"),
          description: values.description,
          resolved: values.resolved,
          resolution: values.resolution || null,
          timeReported: values.timeReported || new Date().toISOString(),
          timeArrived: values.timeArrived || null,
          timeBackInService: values.resolved ? (values.timeBackInService || new Date().toISOString()) : null,
          timeLeftSite: values.timeLeftSite || null,
          hasDelays: values.hasDelays,
          delayReason: values.hasDelays ? (values.delayReason || null) : null,
          images: imageUrls,
        };

        await setDoc(newBreakdownRef, breakdownData);
        
        if (!values.resolved) {
            const equipmentRef = doc(firestore, 'equipment', values.equipmentId);
            updateDocumentNonBlocking(equipmentRef, { breakdownStatus: 'Active' });
        }

        toast({
          title: 'Breakdown Reported',
          description: `The issue for ${selectedEquipment.name} (${values.component}) has been logged.`,
        });
        router.push(`/equipment/${values.equipmentId}`);

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Failed to Report Breakdown",
            description: error.message || "An unexpected error occurred.",
        });
    } finally {
        setIsSaving(false);
    }
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
              <div className="md:col-span-2">
                <FormField
                    control={form.control}
                    name="resolved"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel>Already Resolved?</FormLabel>
                                <FormDescription>
                                    Check this if the issue has already been fixed and you are logging it after the fact.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
              </div>

                {watchedResolved && (
                    <div className="md:col-span-2">
                        <FormField
                            control={form.control}
                            name="resolution"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Resolution Info</FormLabel>
                                <FormControl>
                                <Textarea
                                    placeholder="Describe how the issue was resolved, what parts were used, and the root cause."
                                    className="resize-none"
                                    {...field}
                                    value={field.value || ''}
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                )}
            </CardContent>
          </Card>

           <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clock />Job Timeline &amp; Logistics</CardTitle>
                    <CardDescription>Enter the times for each stage of the job.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="timeReported" render={({ field }) => (<FormItem><FormLabel>Time Reported</FormLabel><FormControl><Input type="datetime-local" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="timeArrived" render={({ field }) => (<FormItem><FormLabel>Time Arrived On-Site</FormLabel><FormControl><Input type="datetime-local" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="timeBackInService" render={({ field }) => (<FormItem><FormLabel>Time Back in Service</FormLabel><FormControl><Input type="datetime-local" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />
                    <FormField control={form.control} name="timeLeftSite" render={({ field }) => (<FormItem><FormLabel>Time Left Site</FormLabel><FormControl><Input type="datetime-local" {...field} value={field.value ?? ''} /></FormControl></FormItem>)} />

                    <div className="md:col-span-2">
                        <FormField
                            control={form.control}
                            name="hasDelays"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Any Delays Encountered?</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>

                    {watchedHasDelays && (
                        <div className="md:col-span-2">
                            <FormField
                                control={form.control}
                                name="delayReason"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason for Delay</FormLabel>
                                    <FormControl>
                                    <Textarea
                                        placeholder="Describe the cause of the delay (e.g., waiting for parts, safety stand-down)."
                                        className="resize-none"
                                        {...field}
                                        value={field.value || ''}
                                    />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
          
          <Card>
              <CardHeader>
                  <CardTitle>Attach Images</CardTitle>
                  <CardDescription>Upload photos of the breakdown. This can help with diagnosis.</CardDescription>
              </CardHeader>
              <CardContent>
                  <ImageUploader onImagesChange={setImages} title="Breakdown Images" />
              </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSaving ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
