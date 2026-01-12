
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
  FormDescription,
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
import { Separator } from '../ui/separator';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';


const formSchema = z.object({
  breakerAssetNumber: z.string().optional(),
  breakerLocationHierarchy: z.string().optional(),
  breakerManufacturer: z.string().optional(),
  breakerModelRange: z.string().optional(),
  breakerType: z.enum(['MCB', 'MCCB', 'ACB', 'VCB']).optional(),
  breakerRatedVoltage: z.coerce.number().optional(),
  breakerFrameSize: z.coerce.number().optional(),
  breakerBreakingCapacity: z.coerce.number().optional(),
  breakerNumberOfPoles: z.enum(['3', '4']).optional(),
  breakerTripUnitType: z.enum(['Thermal-Magnetic', 'Electronic']).optional(),
  breakerOverloadSetting: z.coerce.number().optional(),
  breakerShortCircuitSetting: z.coerce.number().optional(),
  breakerInstantaneousSetting: z.coerce.number().optional(),
  breakerGroundFaultSetting: z.string().optional(),
  breakerOperationMechanism: z.enum(['Manual', 'Motorized']).optional(),
  breakerMotorVoltage: z.coerce.number().optional(),
  breakerShuntTripVoltage: z.coerce.number().optional(),
  breakerUndervoltageRelease: z.enum(['Yes', 'No']).optional(),
  breakerAuxiliaryContacts: z.string().optional(),
  protectionInstallationDate: z.date().optional(),
  protectionAssignedToId: z.string().optional(),
});

interface EditProtectionFormProps {
    equipment: Equipment;
}

// Helper function to remove undefined properties from an object
function removeUndefinedProps(obj: Record<string, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}

export function EditProtectionForm({ equipment }: EditProtectionFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);
  
  const usersQuery = useMemoFirebase(() => (collection(firestore, 'users')), [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        breakerAssetNumber: equipment.breakerAssetNumber,
        breakerLocationHierarchy: equipment.breakerLocationHierarchy,
        breakerManufacturer: equipment.breakerManufacturer,
        breakerModelRange: equipment.breakerModelRange,
        breakerType: equipment.breakerType,
        breakerRatedVoltage: equipment.breakerRatedVoltage,
        breakerFrameSize: equipment.breakerFrameSize,
        breakerBreakingCapacity: equipment.breakerBreakingCapacity,
        breakerNumberOfPoles: equipment.breakerNumberOfPoles?.toString() as '3' | '4' | undefined,
        breakerTripUnitType: equipment.breakerTripUnitType,
        breakerOverloadSetting: equipment.breakerOverloadSetting,
        breakerShortCircuitSetting: equipment.breakerShortCircuitSetting,
        breakerInstantaneousSetting: equipment.breakerInstantaneousSetting,
        breakerGroundFaultSetting: equipment.breakerGroundFaultSetting,
        breakerOperationMechanism: equipment.breakerOperationMechanism,
        breakerMotorVoltage: equipment.breakerMotorVoltage,
        breakerShuntTripVoltage: equipment.breakerShuntTripVoltage,
        breakerUndervoltageRelease: equipment.breakerUndervoltageRelease,
        breakerAuxiliaryContacts: equipment.breakerAuxiliaryContacts,
        protectionInstallationDate: equipment.protectionInstallationDate ? new Date(equipment.protectionInstallationDate) : undefined,
        protectionAssignedToId: equipment.protectionAssignedToId,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const equipmentRef = doc(firestore, 'equipment', equipment.id);
    const assignedUser = users?.find(u => u.id === values.protectionAssignedToId);

    const processedValues = {
        ...values,
        breakerServiceDescription: equipment.name, // Hardcode the service description
        breakerNumberOfPoles: values.breakerNumberOfPoles ? parseInt(values.breakerNumberOfPoles, 10) as 3 | 4 : undefined,
        protectionInstallationDate: values.protectionInstallationDate ? format(values.protectionInstallationDate, "yyyy-MM-dd") : undefined,
        protectionAssignedToName: assignedUser?.name,
    };
    
    const updateData: Partial<Equipment> = removeUndefinedProps(processedValues);


    updateDocumentNonBlocking(equipmentRef, updateData);

    toast({
      title: 'Protection Details Updated',
      description: `The protection details for ${equipment.name} have been saved.`,
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
                <DialogTitle>Edit Protection Details</DialogTitle>
                <DialogDescription>
                    Update the circuit breaker and protection settings for this equipment.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                        <h4 className="mb-4 font-medium text-sm text-muted-foreground">Identification & Location</h4>
                        <div className="grid gap-4">
                            <FormField control={form.control} name="breakerAssetNumber" render={({ field }) => (<FormItem><FormLabel>Asset Number / Tag ID</FormLabel><FormControl><Input placeholder="e.g., CB-SUB01-F03" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerLocationHierarchy" render={({ field }) => (<FormItem><FormLabel>Location / Hierarchy</FormLabel><FormControl><Input placeholder="Substation > DB > Cubicle" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormItem>
                                <FormLabel>Service / Description</FormLabel>
                                <FormControl>
                                    <Input value={equipment.name} disabled />
                                </FormControl>
                                <FormDescription>This is automatically set to the equipment name.</FormDescription>
                            </FormItem>
                            <FormField control={form.control} name="breakerManufacturer" render={({ field }) => (<FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input placeholder="e.g., Schneider, ABB" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerModelRange" render={({ field }) => (<FormItem><FormLabel>Model Range</FormLabel><FormControl><Input placeholder="e.g., Masterpact NW" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="MCB">MCB (Miniature)</SelectItem><SelectItem value="MCCB">MCCB (Moulded Case)</SelectItem><SelectItem value="ACB">ACB (Air)</SelectItem><SelectItem value="VCB">VCB (Vacuum)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                    <Separator/>
                    <div>
                        <h4 className="mb-4 font-medium text-sm text-muted-foreground">Electrical Ratings (Hard Limits)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="breakerRatedVoltage" render={({ field }) => (<FormItem><FormLabel>Rated Voltage (V)</FormLabel><FormControl><Input type="number" placeholder="e.g., 525" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerFrameSize" render={({ field }) => (<FormItem><FormLabel>Frame Size (A)</FormLabel><FormControl><Input type="number" placeholder="e.g., 400" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerBreakingCapacity" render={({ field }) => (<FormItem><FormLabel>Breaking Capacity (kA)</FormLabel><FormControl><Input type="number" placeholder="e.g., 36" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerNumberOfPoles" render={({ field }) => (<FormItem><FormLabel>Number of Poles</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="3">3-Pole</SelectItem><SelectItem value="4">4-Pole</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                    <Separator/>
                    <div>
                        <h4 className="mb-4 font-medium text-sm text-muted-foreground">Protection Settings (Soft Limits)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="breakerTripUnitType" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Trip Unit Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select trip unit..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Thermal-Magnetic">Thermal-Magnetic</SelectItem><SelectItem value="Electronic">Electronic (Micrologic, Ekip, etc.)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerOverloadSetting" render={({ field }) => (<FormItem><FormLabel>Overload (Ir)</FormLabel><FormControl><Input type="number" placeholder="e.g., 320" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Long-time current</FormDescription><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerShortCircuitSetting" render={({ field }) => (<FormItem><FormLabel>Short-Circuit (Isd)</FormLabel><FormControl><Input type="number" placeholder="e.g., 5" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Short-time delay</FormDescription><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerInstantaneousSetting" render={({ field }) => (<FormItem><FormLabel>Instantaneous (Ii)</FormLabel><FormControl><Input type="number" placeholder="e.g., 10" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Immediate trip</FormDescription><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerGroundFaultSetting" render={({ field }) => (<FormItem><FormLabel>Ground Fault (Ig)</FormLabel><FormControl><Input placeholder="Sensitivity (A) & Time (s)" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Is it enabled?</FormDescription><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                    <Separator/>
                    <div>
                        <h4 className="mb-4 font-medium text-sm text-muted-foreground">Accessories & Control</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="breakerOperationMechanism" render={({ field }) => (<FormItem><FormLabel>Operation Mechanism</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Manual">Manual (Handle)</SelectItem><SelectItem value="Motorized">Motorized (Electrical)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerMotorVoltage" render={({ field }) => (<FormItem><FormLabel>Motor Voltage (V)</FormLabel><FormControl><Input type="number" placeholder="110, 230, 24" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerShuntTripVoltage" render={({ field }) => (<FormItem><FormLabel>Shunt Trip Voltage (V)</FormLabel><FormControl><Input type="number" placeholder="e.g., 220" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerUndervoltageRelease" render={({ field }) => (<FormItem><FormLabel>Undervoltage Release</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="breakerAuxiliaryContacts" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Auxiliary Contacts</FormLabel><FormControl><Input placeholder="e.g., 2 NO + 2 NC" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                    <Separator/>
                     <div>
                        <h4 className="mb-4 font-medium text-sm text-muted-foreground">Maintenance & Assignment</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="protectionInstallationDate"
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
                                name="protectionAssignedToId"
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
                        </div>
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
