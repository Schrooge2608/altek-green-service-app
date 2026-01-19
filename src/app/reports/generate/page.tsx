'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Copy, Save, Calendar as CalendarIcon, Shield, Power, Cpu, Droplets, BatteryCharging } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { collection, serverTimestamp, addDoc } from 'firebase/firestore';
import type { GeneratedReport } from '@/lib/types';
import { generateReport, type ReportInput } from '@/ai/flows/generate-report-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const formSchema = z.object({
  vsds: z.object({
    include: z.boolean().default(false),
    avgTemp: z.coerce.number().optional(),
    maxCurrent: z.coerce.number().optional(),
    filtersCleaned: z.boolean().default(false),
    tripHistory: z.string().optional(),
  }),
  upsSystems: z.object({
    include: z.boolean().default(false),
    load: z.string().optional(),
    outputVoltage: z.coerce.number().optional(),
    roomTemp: z.coerce.number().optional(),
    visualOk: z.boolean().default(false),
    terminalsClean: z.boolean().default(false),
  }),
  btus: z.object({
    include: z.boolean().default(false),
    floatVoltage: z.coerce.number().optional(),
    loadCurrent: z.coerce.number().optional(),
    earthFaultStatus: z.enum(['Healthy', 'Positive Fault', 'Negative Fault']).optional(),
  }),
  protectionRelays: z.object({
    include: z.boolean().default(false),
    lastTripEvent: z.string().optional(),
    lastTestDate: z.date().optional(),
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function GenerateReportPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user } = useUser();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [generatedReport, setGeneratedReport] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<DateRange | undefined>({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            vsds: { include: false, filtersCleaned: false },
            upsSystems: { include: false, visualOk: false, terminalsClean: false },
            btus: { include: false },
            protectionRelays: { include: false },
        },
    });

    const handleCopy = () => {
        if (!generatedReport) return;
        navigator.clipboard.writeText(generatedReport);
        toast({ title: 'Report Copied', description: 'The report text has been copied to your clipboard.' });
    };

    const handleSaveReport = async () => {
        if (!generatedReport || !date?.from || !date?.to || !user) {
            toast({ variant: 'destructive', title: 'Cannot Save', description: 'No report, date range, or user session found.' });
            return;
        }

        setIsSaving(true);
        try {
            const reportsRef = collection(firestore, 'generated_reports');
            const reportData: Omit<GeneratedReport, 'id'> = {
                reportText: generatedReport,
                startDate: format(date.from, 'yyyy-MM-dd'),
                endDate: format(date.to, 'yyyy-MM-dd'),
                generatedAt: serverTimestamp(),
                generatedByUserId: user.uid,
                generatedByUserName: user.displayName || user.email || 'Unknown User',
            };
            const newDocRef = await addDoc(reportsRef, reportData);
            toast({ title: 'Report Saved', description: 'The generated report has been saved to the history.' });
            router.push(`/reports/history/${newDocRef.id}`);
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the report to the database.' });
        } finally {
            setIsSaving(false);
        }
    };

    const onSubmit = async (data: FormValues) => {
        if (!date?.from || !date?.to) {
            toast({ variant: 'destructive', title: 'No Date Range Selected', description: 'Please select a start and end date for the report.' });
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedReport('');

        const reportInput: ReportInput = {
            startDate: format(date.from, 'yyyy-MM-dd'),
            endDate: format(date.to, 'yyyy-MM-dd'),
            vsds: data.vsds.include ? data.vsds : null,
            upsSystems: data.upsSystems.include ? data.upsSystems : null,
            btus: data.btus.include ? data.btus : null,
            protectionRelays: data.protectionRelays.include ? { ...data.protectionRelays, lastTestDate: data.protectionRelays.lastTestDate ? format(data.protectionRelays.lastTestDate, 'yyyy-MM-dd') : undefined } : null,
        };
        
        try {
            const result = await generateReport(reportInput);
            setGeneratedReport(result.report);
            toast({ title: 'Report Generated', description: 'The weekly summary report has been created below.' });
        } catch (e: any) {
            console.error(e);
            setError('Failed to generate the report. The AI model may be temporarily unavailable or encountered an error.');
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message || 'An unknown error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">AI Weekly Technical Report</h1>
                <p className="text-muted-foreground">
                    Enter technical data for each section to generate a comprehensive weekly report.
                </p>
            </header>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Report Period</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/>
                                </PopoverContent>
                            </Popover>
                        </CardContent>
                    </Card>

                    {/* VSD Section */}
                    <Collapsible defaultOpen>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div className="space-y-1.5">
                            <CardTitle className="flex items-center gap-2"><Cpu />VSDs (Variable Speed Drives)</CardTitle>
                          </div>
                          <FormField control={form.control} name="vsds.include" render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormLabel>Include in Report?</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              </FormItem>
                          )} />
                        </CardHeader>
                        <CollapsibleContent asChild>
                          <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FormField control={form.control} name="vsds.avgTemp" render={({ field }) => (<FormItem><FormLabel>Avg. Operating Temp (°C)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="vsds.maxCurrent" render={({ field }) => (<FormItem><FormLabel>Max Current (Amps)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="vsds.filtersCleaned" render={({ field }) => (<FormItem className="flex flex-row items-end space-x-2 pb-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="leading-none">Fan Filters Cleaned?</FormLabel></FormItem>)} />
                            <FormField control={form.control} name="vsds.tripHistory" render={({ field }) => (<FormItem className="col-span-full"><FormLabel>Trip History / Notes</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>)} />
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>

                    {/* UPS Section */}
                     <Collapsible defaultOpen>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div className="space-y-1.5">
                            <CardTitle className="flex items-center gap-2"><Power />UPS Systems</CardTitle>
                          </div>
                           <FormField control={form.control} name="upsSystems.include" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormLabel>Include in Report?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        </CardHeader>
                        <CollapsibleContent asChild>
                          <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FormField control={form.control} name="upsSystems.load" render={({ field }) => (<FormItem><FormLabel>Load % (L1/L2/L3)</FormLabel><FormControl><Input placeholder="e.g. 80/82/81" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="upsSystems.outputVoltage" render={({ field }) => (<FormItem><FormLabel>Output Voltage (V)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="upsSystems.roomTemp" render={({ field }) => (<FormItem><FormLabel>Room Temp (°C)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                             <div className="col-span-full grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="upsSystems.visualOk" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-2 pt-6"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="leading-none">Visual Inspection OK</FormLabel></FormItem>)} />
                                <FormField control={form.control} name="upsSystems.terminalsClean" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-2 pt-6"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="leading-none">Terminals Clean</FormLabel></FormItem>)} />
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                    
                     {/* BTU Section */}
                     <Collapsible defaultOpen>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div className="space-y-1.5">
                            <CardTitle className="flex items-center gap-2"><BatteryCharging />BTUs (DC System)</CardTitle>
                          </div>
                           <FormField control={form.control} name="btus.include" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormLabel>Include in Report?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        </CardHeader>
                        <CollapsibleContent asChild>
                          <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FormField control={form.control} name="btus.floatVoltage" render={({ field }) => (<FormItem><FormLabel>Float Voltage (V)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="btus.loadCurrent" render={({ field }) => (<FormItem><FormLabel>Load Current (A)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="btus.earthFaultStatus" render={({ field }) => (<FormItem className="lg:col-span-full"><FormLabel>Earth Fault Status</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2"><FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Healthy" id="healthy" /></FormControl><FormLabel htmlFor="healthy">Healthy</FormLabel></FormItem><FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Positive Fault" id="pos" /></FormControl><FormLabel htmlFor="pos">Positive Fault</FormLabel></FormItem><FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Negative Fault" id="neg" /></FormControl><FormLabel htmlFor="neg">Negative Fault</FormLabel></FormItem></RadioGroup></FormControl></FormItem>)} />
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                    
                    {/* Protection Relays Section */}
                    <Collapsible defaultOpen>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div className="space-y-1.5">
                            <CardTitle className="flex items-center gap-2"><Shield />Protection Relays</CardTitle>
                          </div>
                          <FormField control={form.control} name="protectionRelays.include" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormLabel>Include in Report?</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                        </CardHeader>
                        <CollapsibleContent asChild>
                          <CardContent className="grid md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="protectionRelays.lastTripEvent" render={({ field }) => (<FormItem><FormLabel>Last Trip Event (Feeder Name)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="protectionRelays.lastTestDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Secondary Injection Test Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem>)} />
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            {isLoading ? 'Generating...' : 'Generate Report'}
                        </Button>
                    </div>
                </form>
            </Form>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {generatedReport && (
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><FileText /> Generated Report</CardTitle>
                            <CardDescription>Review the report below. You can copy it or save it to the report history.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleCopy}><Copy className="mr-2 h-4 w-4" />Copy</Button>
                            <Button onClick={handleSaveReport} disabled={isSaving}><Save className="mr-2 h-4 w-4" />Save</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <pre className="p-4 bg-muted rounded-md border font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                            {generatedReport}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
