
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
  valveType: z.string().optional(),
  valveBrand: z.string().optional(),
  valveModel: z.string().optional(),
  valveSerialNumber: z.string().optional(),
  valveSizeInches: z.coerce.number().optional(),
  valveActuatorType: z.string().optional(),
  valveAssignedToId: z.string().optional(),
});

interface EditValveFormProps {
    equipment: Equipment;
}

function removeUndefinedProps(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

export function EditValveForm({ equipment }: EditValveFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  
  const usersQuery = useMemoFirebase(() => (collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        valveType: equipment.valveType,
        valveBrand: equipment.valveBrand,
        valveModel: equipment.valveModel,
        valveSerialNumber: equipment.valveSerialNumber,
        valveSizeInches: equipment.valveSizeInches,
        valveActuatorType: equipment.valveActuatorType,
        valveAssignedToId: equipment.valveAssignedToId,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const equipmentRef = doc(firestore, 'equipment', equipment.id);
    const assignedUser = users?.find(u => u.id === values.valveAssignedToId);

    const updateData: Partial<Equipment> = {
      ...values,
      valveAssignedToId: values.valveAssignedToId === 'unassigned' ? '' : values.valveAssignedToId,
      valveAssignedToName: assignedUser?.name || '',
    };
    
    updateDocumentNonBlocking(equipmentRef, removeUndefinedProps(updateData));

    toast({
      title: 'Valve Details Updated',
      description: `The valve details for ${equipment.name} have been saved.`,
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
                <DialogTitle>Edit Valve Details</DialogTitle>
                <DialogDescription>
                    Update the valve information for this equipment.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="valveType" render={({ field }) => (<FormItem><FormLabel>Valve Type</FormLabel><FormControl><Input placeholder="e.g., Ball, Gate" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="valveBrand" render={({ field }) => (<FormItem><FormLabel>Valve Brand</FormLabel><FormControl><Input placeholder="e.g., Fisher" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="valveModel" render={({ field }) => (<FormItem><FormLabel>Valve Model</FormLabel><FormControl><Input placeholder="e.g., Vee-Ball V150" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="valveSerialNumber" render={({ field }) => (<FormItem><FormLabel>Valve Serial Number</FormLabel><FormControl><Input placeholder="e.g., SN-VALVE-789" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="valveSizeInches" render={({ field }) => (<FormItem><FormLabel>Valve Size (Inches)</FormLabel><FormControl><Input type="number" placeholder="e.g., 6" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="valveActuatorType" render={({ field }) => (<FormItem><FormLabel>Actuator Type</FormLabel><FormControl><Input placeholder="e.g., Manual, Electric" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="valveAssignedToId" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Assigned Valve Technician</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Assign a technician..." /></SelectTrigger></FormControl><SelectContent>{usersLoading ? (<SelectItem value="loading" disabled>Loading users...</SelectItem>) : (<><SelectItem value="unassigned">Unassigned</SelectItem>{users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</>)}</SelectContent></Select><FormMessage /></FormItem>)} />
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
    