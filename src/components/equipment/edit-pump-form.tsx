
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, updateDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { Equipment, User } from '@/lib/types';
import { Loader2, Pencil } from 'lucide-react';
import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

const formSchema = z.object({
  pumpType: z.string().optional(),
  pumpBrand: z.string().optional(),
  pumpSerialNumber: z.string().optional(),
  pumpManufacturer: z.string().optional(),
  pumpHead: z.coerce.number().optional(),
  flowRate: z.coerce.number().optional(),
  pumpImpellerDiameter: z.coerce.number().optional(),
  pumpCommissionDate: z.date().optional(),
  pumpFlangeSizeIn: z.coerce.number().optional(),
  pumpFlangeSizeOutlet: z.coerce.number().optional(),
  pumpFrameSize: z.string().optional(),
  pumpFrameType: z.string().optional(),
  pumpAssignedToId: z.string().optional(),
});

interface EditPumpFormProps {
    equipment: Equipment;
}

function removeUndefinedProps(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

export function EditPumpForm({ equipment }: EditPumpFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  
  const usersQuery = useMemoFirebase(() => (collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        pumpType: equipment.pumpType,
        pumpBrand: equipment.pumpBrand,
        pumpSerialNumber: equipment.pumpSerialNumber,
        pumpManufacturer: equipment.pumpManufacturer,
        pumpHead: equipment.pumpHead,
        flowRate: equipment.flowRate,
        pumpImpellerDiameter: equipment.pumpImpellerDiameter,
        pumpCommissionDate: equipment.pumpCommissionDate ? new Date(equipment.pumpCommissionDate) : undefined,
        pumpFlangeSizeIn: equipment.pumpFlangeSizeIn,
        pumpFlangeSizeOutlet: equipment.pumpFlangeSizeOutlet,
        pumpFrameSize: equipment.pumpFrameSize,
        pumpFrameType: equipment.pumpFrameType,
        pumpAssignedToId: equipment.pumpAssignedToId,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const equipmentRef = doc(firestore, 'equipment', equipment.id);
    const assignedUser = users?.find(u => u.id === values.pumpAssignedToId);

    const processedValues = {
        ...values,
        pumpCommissionDate: values.pumpCommissionDate ? format(values.pumpCommissionDate, "yyyy-MM-dd") : undefined,
        pumpAssignedToName: assignedUser?.name,
    };
    
    const updateData: Partial<Equipment> = removeUndefinedProps(processedValues);

    updateDocumentNonBlocking(equipmentRef, updateData);

    toast({
      title: 'Pump Details Updated',
      description: `The pump details for ${equipment.name} have been saved.`,
    });
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
            <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
            </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
            <DialogHeader>
                <DialogTitle>Edit Pump Details</DialogTitle>
                <DialogDescription>
                    Update the pump information for this equipment.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="pumpType" render={({ field }) => (<FormItem><FormLabel>Pump Type</FormLabel><FormControl><Input placeholder="e.g., Centrifugal" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpBrand" render={({ field }) => (<FormItem><FormLabel>Pump Brand</FormLabel><FormControl><Input placeholder="e.g., KSB" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpSerialNumber" render={({ field }) => (<FormItem><FormLabel>Pump Serial Number</FormLabel><FormControl><Input placeholder="e.g., SN-PUMP-789" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpManufacturer" render={({ field }) => (<FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input placeholder="e.g., KSB Group" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpHead" render={({ field }) => (<FormItem><FormLabel>Pump Head (m)</FormLabel><FormControl><Input type="number" placeholder="e.g., 50" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="flowRate" render={({ field }) => (<FormItem><FormLabel>Flow Rate (m³/h)</FormLabel><FormControl><Input type="number" placeholder="e.g., 120" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpImpellerDiameter" render={({ field }) => (<FormItem><FormLabel>Impeller Diameter (mm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 250" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpCommissionDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Date Commissioned</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpFlangeSizeIn" render={({ field }) => (<FormItem><FormLabel>Flange Size In (mm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpFlangeSizeOutlet" render={({ field }) => (<FormItem><FormLabel>Flange Size Outlet (mm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 80" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpFrameSize" render={({ field }) => (<FormItem><FormLabel>Frame Size</FormLabel><FormControl><Input placeholder="e.g., 160M" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpFrameType" render={({ field }) => (<FormItem><FormLabel>Frame Type</FormLabel><FormControl><Input placeholder="e.g., Cast Iron" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="pumpAssignedToId" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Assigned Pump Technician</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Assign a technician..." /></SelectTrigger></FormControl><SelectContent>{usersLoading ? (<SelectItem value="loading" disabled>Loading users...</SelectItem>) : (<><SelectItem value="unassigned">Unassigned</SelectItem>{users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? (
                                <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
  );
}
