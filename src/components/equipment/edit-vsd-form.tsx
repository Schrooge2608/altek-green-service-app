
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
import type { VSD, User } from '@/lib/types';
import { Loader2, Pencil } from 'lucide-react';
import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

const formSchema = z.object({
  driveType: z.enum(['VSD', 'Soft Starter']),
  model: z.string().min(1, 'Model is required'),
  manufacturer: z.string().optional(),
  serialNumber: z.string().min(1, 'Serial number is required'),
  installationDate: z.date({ required_error: "An installation date is required." }),
  status: z.enum(['active', 'inactive', 'maintenance']),
  assignedToId: z.string().optional(),
});

interface EditVsdFormProps {
    vsd: VSD;
}

function removeUndefinedProps(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

export function EditVsdForm({ vsd }: EditVsdFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  
  const usersQuery = useMemoFirebase(() => (collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        driveType: vsd.driveType || 'VSD',
        model: vsd.model,
        manufacturer: vsd.manufacturer,
        serialNumber: vsd.serialNumber,
        installationDate: vsd.installationDate ? new Date(vsd.installationDate) : undefined,
        status: vsd.status,
        assignedToId: vsd.assignedToId,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const vsdRef = doc(firestore, 'vsds', vsd.id);
    const assignedUser = users?.find(u => u.id === values.assignedToId);

    const updateData: Partial<VSD> = {
      ...values,
      installationDate: values.installationDate ? format(values.installationDate, "yyyy-MM-dd") : undefined,
      assignedToId: values.assignedToId === 'unassigned' ? '' : values.assignedToId,
      assignedToName: assignedUser?.name || '',
    };
    
    updateDocumentNonBlocking(vsdRef, removeUndefinedProps(updateData));

    toast({
      title: 'Controller Details Updated',
      description: `The controller details for ${vsd.id} have been saved.`,
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
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>Edit Controller Information</DialogTitle>
                <DialogDescription>
                    Update the controller information for this equipment.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <FormField
                        control={form.control}
                        name="driveType"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Controller Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a controller type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="VSD">VSD</SelectItem>
                                    <SelectItem value="Soft Starter">Soft Starter</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="model" render={({ field }) => (<FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="e.g., Altek Drive 5000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="manufacturer" render={({ field }) => (<FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input placeholder="e.g., Allen-Bradley" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="serialNumber" render={({ field }) => (<FormItem><FormLabel>Serial Number</FormLabel><FormControl><Input placeholder="e.g., SN-A1B2-C3D4" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="installationDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Installation Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="assignedToId" render={({ field }) => (<FormItem><FormLabel>Assigned Technician</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Assign a technician..." /></SelectTrigger></FormControl><SelectContent>{usersLoading ? (<SelectItem value="loading" disabled>Loading users...</SelectItem>) : (<><SelectItem value="unassigned">Unassigned</SelectItem>{users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</>)}</SelectContent></Select><FormMessage /></FormItem>)} />

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
    