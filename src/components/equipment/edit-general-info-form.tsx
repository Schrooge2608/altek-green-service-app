
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
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Loader2, Pencil } from 'lucide-react';
import { useState } from 'react';


const dredgerLocations = ['MPA','MPC','MPD','MPE', "MPC DRY MINING"];

const formSchema = z.object({
  name: z.string().min(1, 'Equipment name is required'),
  plant: z.enum(['Mining', 'Smelter']),
  division: z.enum(["Boosters", "Dredgers", "Pump Stations"]).optional(),
  location: z.string().min(1, 'Location is required'),
});

interface EditGeneralInfoFormProps {
    equipment: Equipment;
}

export function EditGeneralInfoForm({ equipment }: EditGeneralInfoFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: equipment.name,
      plant: equipment.plant,
      division: equipment.division,
      location: equipment.location,
    },
  });

  const watchedPlant = useWatch({ control: form.control, name: 'plant' });
  const watchedDivision = useWatch({ control: form.control, name: 'division' });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.plant === 'Mining' && !values.division) {
        form.setError('division', { type: 'manual', message: 'Please select a division for the Mining plant.' });
        return;
    }

    const equipmentRef = doc(firestore, 'equipment', equipment.id);
    
    const updateData: Partial<Equipment> = {
        name: values.name,
        plant: values.plant,
        division: values.plant === 'Mining' ? values.division : undefined,
        location: values.location,
    };

    updateDocumentNonBlocking(equipmentRef, updateData);

    toast({
      title: 'Equipment Updated',
      description: `${values.name} has been successfully updated.`,
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
                <DialogTitle>Edit General Information</DialogTitle>
                <DialogDescription>
                    Make changes to the equipment's core details here. Click save when you're done.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid gap-4 py-4">
                        <FormField
                            control={form.control}
                            name="name"
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
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    <SelectItem value="Boosters">Boosters</SelectItem>
                                    <SelectItem value="Dredgers">Dredgers</SelectItem>
                                    <SelectItem value="Pump Stations">Pump Stations</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        )}
                        {watchedPlant === 'Mining' && watchedDivision === 'Dredgers' ? (
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
                                    {dredgerLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
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
