
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
import { Loader2, Pencil, Fan } from 'lucide-react';
import React, { useState } from 'react';

const formSchema = z.object({
  fanType: z.string().optional(),
  fanBrand: z.string().optional(),
  fanModel: z.string().optional(),
  fanSerialNumber: z.string().optional(),
  fanAirflowCFM: z.coerce.number().optional(),
  fanBladeDiameter: z.coerce.number().optional(),
  fanAssignedToId: z.string().optional(),
});

interface EditFanFormProps {
    equipment: Equipment;
}

function removeUndefinedProps(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

export function EditFanForm({ equipment }: EditFanFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  
  const usersQuery = useMemoFirebase(() => (collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fanType: equipment.fanType,
      fanBrand: equipment.fanBrand,
      fanModel: equipment.fanModel,
      fanSerialNumber: equipment.fanSerialNumber,
      fanAirflowCFM: equipment.fanAirflowCFM,
      fanBladeDiameter: equipment.fanBladeDiameter,
      fanAssignedToId: equipment.fanAssignedToId,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const equipmentRef = doc(firestore, 'equipment', equipment.id);
    const assignedUser = users?.find(u => u.id === values.fanAssignedToId);

    const processedValues = {
        ...values,
        fanAssignedToName: assignedUser?.name,
    };
    
    const updateData: Partial<Equipment> = removeUndefinedProps(processedValues);

    updateDocumentNonBlocking(equipmentRef, updateData);

    toast({
      title: 'Fan Details Updated',
      description: `The fan details for ${equipment.name} have been saved.`,
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
                <DialogTitle>Edit Fan Details</DialogTitle>
                <DialogDescription>
                    Update the fan information for this equipment.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="fanType" render={({ field }) => (<FormItem><FormLabel>Fan Type</FormLabel><FormControl><Input placeholder="e.g., Axial" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="fanBrand" render={({ field }) => (<FormItem><FormLabel>Fan Brand</FormLabel><FormControl><Input placeholder="e.g., Ziehl-Abegg" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="fanModel" render={({ field }) => (<FormItem><FormLabel>Fan Model</FormLabel><FormControl><Input placeholder="e.g., FN050" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="fanSerialNumber" render={({ field }) => (<FormItem><FormLabel>Fan Serial Number</FormLabel><FormControl><Input placeholder="e.g., SN-FAN-456" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="fanAirflowCFM" render={({ field }) => (<FormItem><FormLabel>Airflow (CFM)</FormLabel><FormControl><Input type="number" placeholder="e.g., 5000" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="fanBladeDiameter" render={({ field }) => (<FormItem><FormLabel>Blade Diameter (mm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 500" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="fanAssignedToId" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Assigned Fan Technician</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Assign a technician..." /></SelectTrigger></FormControl><SelectContent>{usersLoading ? (<SelectItem value="loading" disabled>Loading users...</SelectItem>) : (<><SelectItem value="unassigned">Unassigned</SelectItem>{users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</>)}</SelectContent></Select><FormMessage /></FormItem>)} />
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
