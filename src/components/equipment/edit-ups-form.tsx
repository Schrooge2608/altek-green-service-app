
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
  upsModel: z.string().optional(),
  upsSerialNumber: z.string().optional(),
  batteryType: z.string().optional(),
  upsInstallationDate: z.date().optional(),
  lastBatteryReplacement: z.date().optional(),
  upsAssignedToId: z.string().optional(),
});

interface EditUpsFormProps {
    equipment: Equipment;
}

// Helper function to remove undefined properties from an object
function removeUndefinedProps(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

export function EditUpsForm({ equipment }: EditUpsFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  
  const usersQuery = useMemoFirebase(() => (collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        upsModel: equipment.upsModel,
        upsSerialNumber: equipment.upsSerialNumber,
        batteryType: equipment.batteryType,
        upsInstallationDate: equipment.upsInstallationDate ? new Date(equipment.upsInstallationDate) : undefined,
        lastBatteryReplacement: equipment.lastBatteryReplacement ? new Date(equipment.lastBatteryReplacement) : undefined,
        upsAssignedToId: equipment.upsAssignedToId,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const equipmentRef = doc(firestore, 'equipment', equipment.id);
    const assignedUser = users?.find(u => u.id === values.upsAssignedToId);

    const processedValues = {
        ...values,
        upsInstallationDate: values.upsInstallationDate ? format(values.upsInstallationDate, "yyyy-MM-dd") : undefined,
        lastBatteryReplacement: values.lastBatteryReplacement ? format(values.lastBatteryReplacement, "yyyy-MM-dd") : undefined,
        upsAssignedToName: assignedUser?.name,
    };
    
    const updateData: Partial<Equipment> = removeUndefinedProps(processedValues);

    updateDocumentNonBlocking(equipmentRef, updateData);

    toast({
      title: 'UPS/BTU Details Updated',
      description: `The UPS/BTU details for ${equipment.name} have been saved.`,
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
                <DialogTitle>Edit UPS/BTU Details</DialogTitle>
                <DialogDescription>
                    Update the battery backup unit information for this equipment.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <FormField
                        control={form.control}
                        name="upsModel"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>UPS Model</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Eaton 9PX" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="upsSerialNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>UPS Serial Number</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., SN-UPS-123" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="batteryType"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Battery Type</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Lead-Acid, Li-Ion" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="upsInstallationDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Installation Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                    {field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="lastBatteryReplacement"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Last Battery Replacement</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                    {field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="upsAssignedToId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Assigned Technician</FormLabel>
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
