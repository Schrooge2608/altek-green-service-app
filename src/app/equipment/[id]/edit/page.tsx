
'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  name: z.string().min(1, 'Equipment name is required'),
});

export default function EditEquipmentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = typeof params.id === 'string' ? params.id : '';
  const firestore = useFirestore();

  const eqRef = useMemoFirebase(() => (id ? doc(firestore, 'equipment', id) : null), [firestore, id]);
  const { data: eq, isLoading: eqLoading } = useDoc<Equipment>(eqRef);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (eq) {
      form.reset({
        name: eq.name,
      });
    }
  }, [eq, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!eqRef) return;
    
    const updateData: Partial<Equipment> = {
        name: values.name,
    };

    updateDocumentNonBlocking(eqRef, updateData);

    toast({
      title: 'Equipment Updated',
      description: `${values.name} has been successfully updated.`,
    });
    router.push(`/equipment/${id}`);
  }

  if (eqLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="ml-2">Loading equipment data...</p>
      </div>
    );
  }

  if (!eq) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Edit Equipment: {eq.name}</h1>
        <p className="text-muted-foreground">
          Update the details for the selected equipment cluster.
        </p>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
                <CardTitle>Equipment Details</CardTitle>
                <CardDescription>Update information about the main equipment unit.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
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
                <FormItem>
                    <FormLabel>Equipment ID (Read-only)</FormLabel>
                    <Input readOnly disabled value={eq.id} />
                </FormItem>
                <FormItem>
                    <FormLabel>Plant</FormLabel>
                    <Input readOnly disabled value={eq.plant} />
                </FormItem>
                 {eq.division && (
                    <FormItem>
                        <FormLabel>Division</FormLabel>
                        <Input readOnly disabled value={eq.division} />
                    </FormItem>
                 )}
                 <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Input readOnly disabled value={eq.location} />
                </FormItem>
            </CardContent>
          </Card>

           <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
