'use client';

import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, FileText, Copy, Save, Calendar as CalendarIcon, Shield, Power, Cpu } from 'lucide-react';
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

const sectionSchema = z.object({
  nothingToReport: z.boolean(),
  breakdownDetails: z.string().optional(),
  pmCompleted: z.string().optional(),
  technicianNotes: z.string().optional(),
});

const formSchema = z.object({
  vsds: sectionSchema,
  upsSystems: sectionSchema,
  btus: sectionSchema,
  protectionUnits: sectionSchema,
});

type FormValues = z.infer<typeof formSchema>;

const ReportSection = ({ control, name, title, icon: Icon }: { control: any, name: keyof FormValues, title: string, icon: React.ElementType }) => {
    const watchNothingToReport = useWatch({
        control,
        name: `${name}.nothingToReport`,
    });

    return (
        <Card>
            <CardHeader>
                <FormField
                    control={control}
                    name={`${name}.nothingToReport`}
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2"><Icon className="h-5 w-5" />{title}</FormLabel>
                            </div>
                            <div className="flex items-center space-x-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel>Nothing to report</FormLabel>
                            </div>
                        </FormItem>
                    )}
                />
            </CardHeader>
            {!watchNothingToReport && (
                <CardContent className="space-y-4 pt-0">
                    <FormField
                        control={control}
                        name={`${name}.breakdownDetails`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Breakdown Details</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Describe any breakdowns..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name={`${name}.pmCompleted`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>PM Completed</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Detail preventative maintenance completed..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name={`${name}.technicianNotes`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Technician Notes</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Add any other relevant notes..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            )}
        </Card>
    );
};


export default function GenerateReportPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
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
            vsds: { nothingToReport: true, breakdownDetails: '', pmCompleted: '', technicianNotes: '' },
            upsSystems: { nothingToReport: true, breakdownDetails: '', pmCompleted: '', technicianNotes: '' },
            btus: { nothingToReport: true, breakdownDetails: '', pmCompleted: '', technicianNotes: '' },
            protectionUnits: { nothingToReport: true, breakdownDetails: '', pmCompleted: '', technicianNotes: '' },
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
            vsds: data.vsds.nothingToReport ? null : data.vsds,
            upsSystems: data.upsSystems.nothingToReport ? null : data.upsSystems,
            btus: data.btus.nothingToReport ? null : data.btus,
            protectionUnits: data.protectionUnits.nothingToReport ? null : data.protectionUnits,
        };

        try {
            const result = await generateReport(reportInput);
            setGeneratedReport(result.report);
            toast({ title: 'Report Generated', description: 'The weekly summary report has been created below.' });
        } catch (e: any) {
            console.error(e);
            setError('Failed to generate the report. The AI model may be temporarily unavailable.');
            toast({ variant: 'destructive', title: 'Generation Failed', description: e.message || 'An unknown error occurred.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">AI Weekly Report Generator</h1>
                <p className="text-muted-foreground">
                    Manually enter details for each section to generate a comprehensive weekly report.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Report Period</CardTitle>
                    <CardDescription>Select the date range for the report. It defaults to the current week.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Pick a date range</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                        />
                        </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <ReportSection control={form.control} name="vsds" title="VSDs (Variable Speed Drives)" icon={Cpu} />
                    <ReportSection control={form.control} name="upsSystems" title="UPS Systems" icon={Power} />
                    <ReportSection control={form.control} name="btus" title="BTUs (Battery Tripping Units)" icon={Power} />
                    <ReportSection control={form.control} name="protectionUnits" title="Protection Units" icon={Shield} />
                    
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
                            <Button variant="outline" onClick={handleCopy}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Report
                            </Button>
                            <Button onClick={handleSaveReport} disabled={isSaving || isUserLoading}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Report
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-muted rounded-md border font-mono text-sm whitespace-pre-wrap">
                            {generatedReport}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
