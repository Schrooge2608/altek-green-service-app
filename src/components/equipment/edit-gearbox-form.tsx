
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

const formSchema = z.object({
  gearboxModel: z.string().optional(),
  gearboxBrand: z.string().optional(),
  gearboxRatio: z.string().optional(),
  gearboxSerialNumber: z.string().optional(),
  gearboxOilType: z.string().optional(),
  gearboxOilCapacityLiters: z.coerce.number().optional(),
  gearboxAssignedToId: z.string().optional(),
});

interface EditGearboxFormProps {
    equipment: Equipment;
}

function removeUndefinedProps(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

export function EditGearboxForm({ equipment }: EditGearboxFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  
  const usersQuery = useMemoFirebase(() => (collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        gearboxModel: equipment.gearboxModel,
        gearboxBrand: equipment.gearboxBrand,
        gearboxRatio: equipment.gearboxRatio,
        gearboxSerialNumber: equipment.gearboxSerialNumber,
        gearboxOilType: equipment.gearboxOilType,
        gearboxOilCapacityLiters: equipment.gearboxOilCapacityLiters,
        gearboxAssignedToId: equipment.gearboxAssignedToId,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const equipmentRef = doc(firestore, 'equipment', equipment.id);
    const assignedUser = users?.find(u => u.id === values.gearboxAssignedToId);

    const updateData: Partial<Equipment> = {
      ...values,
      gearboxAssignedToId: values.gearboxAssignedToId === 'unassigned' ? '' : values.gearboxAssignedToId,
      gearboxAssignedToName: assignedUser?.name || '',
    };
    
    updateDocumentNonBlocking(equipmentRef, removeUndefinedProps(updateData));

    toast({
      title: 'Gearbox Details Updated',
      description: `The gearbox details for ${equipment.name} have been saved.`,
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
                <DialogTitle>Edit Gearbox Details</DialogTitle>
                <DialogDescription>
                    Update the gearbox information for this equipment.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="gearboxModel" render={({ field }) => (<FormItem><FormLabel>Gearbox Model</FormLabel><FormControl><Input placeholder="e.g., Helical G5" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="gearboxBrand" render={({ field }) => (<FormItem><FormLabel>Gearbox Brand</FormLabel><FormControl><Input placeholder="e.g., SEW-Eurodrive" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="gearboxRatio" render={({ field }) => (<FormItem><FormLabel>Gear Ratio</FormLabel><FormControl><Input placeholder="e.g., 50:1" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="gearboxSerialNumber" render={({ field }) => (<FormItem><FormLabel>Gearbox Serial Number</FormLabel><FormControl><Input placeholder="e.g., SN-GB-123" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="gearboxOilType" render={({ field }) => (<FormItem><FormLabel>Oil Type</FormLabel><FormControl><Input placeholder="e.g., ISO VG 220" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="gearboxOilCapacityLiters" render={({ field }) => (<FormItem><FormLabel>Oil Capacity (Liters)</FormLabel><FormControl><Input type="number" placeholder="e.g., 5.5" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="gearboxAssignedToId" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Assigned Gearbox Technician</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Assign a technician..." /></SelectTrigger></FormControl><SelectContent>{usersLoading ? (<SelectItem value="loading" disabled>Loading users...</SelectItem>) : (<><SelectItem value="unassigned">Unassigned</SelectItem>{users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                            ) : ( "Save Changes" )}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
  );
}
    