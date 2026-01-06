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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from 'lucide-react';
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Equipment } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';


const formSchema = z.object({
  equipmentId: z.string().min(1, 'Please select a piece of equipment.'),
  date: z.date({
    required_error: "A breakdown date is required.",
  }),
  description: z.string().min(10, 'Please provide a detailed description of the issue.').max(500),
});


export default function NewBreakdownPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const selectedEquipment = equipment?.find(e => e.id === values.equipmentId);

    if (!selectedEquipment) {
        toast({
          variant: "destructive",
          title: 'Invalid Equipment',
          description: `Could not find the selected equipment.`,
        });
        return;
    }

    const breakdownRef = collection(firestore, 'breakdown_reports');

    const breakdownData = {
      equipmentId: values.equipmentId,
      equipmentName: selectedEquipment.name,
      date: format(values.date, "yyyy-MM-dd"),
      description: values.description,
      resolved: false,
    };

    addDocumentNonBlocking(breakdownRef, breakdownData);

    toast({
      title: 'Breakdown Reported',
      description: `The issue for ${selectedEquipment.name} has been logged.`,
    });
    form.reset();
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
              <CardDescription>Select the equipment and describe the issue.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={equipmentLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select the affected equipment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {equipmentLoading ? (
                            <SelectItem value="loading" disabled>Loading equipment...</SelectItem>
                        ) : (
                            equipment?.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.id})</SelectItem>)
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
            </CardContent>
          </Card>
          
          <div className="flex justify-end">
            <Button type="submit" variant="destructive">Submit Report</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
