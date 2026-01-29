
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, ArrowLeft, Lock, CheckCircle, Clock } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormDescription, FormMessage } from '@/components/ui/form';
import { useUser, useMemoFirebase, useFirebase, useDoc } from '@/firebase';
import { doc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams, notFound } from 'next/navigation';
import type { Breakdown, User } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { format, parseISO } from 'date-fns';
import { AutoFormatTextarea } from '@/components/ui/auto-format-textarea';

type BreakdownForm = Breakdown;

// Helper to format dates for datetime-local input, handling potential invalid dates
const formatDateTimeLocal = (dateString?: string | null): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        // Check if the date is valid
        if (isNaN(date.getTime())) return '';
        // Format to "yyyy-MM-ddTHH:mm" which is required by the input
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
        console.error("Error formatting date:", error);
        return '';
    }
};

export default function BreakdownDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();
    
    const { data: userData, isLoading: userDataLoading } = useDoc<User>(
        useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
    );
    
    const breakdownId = params?.id as string;
    const [isSaving, setIsSaving] = useState(false);

    const { data: report, isLoading: reportLoading } = useDoc<BreakdownForm>(
        useMemoFirebase(() => breakdownId ? doc(firestore, 'breakdown_reports', breakdownId) : null, [firestore, breakdownId])
    );

    const form = useForm<BreakdownForm>({
        defaultValues: {
            equipmentName: '',
            description: '',
            resolved: false,
            resolution: '',
            timeReported: '',
            timeArrived: '',
            timeBackInService: '',
            timeLeftSite: '',
            hasDelays: false,
            delayReason: '',
        }
    });

    const hasDelays = useWatch({
        control: form.control,
        name: 'hasDelays',
    });

    const isCreator = user?.uid === report?.userId;
    const isManager = userData?.role === 'Manager' || userData?.role === 'Admin' || userData?.role === 'Superadmin' || userData?.role === 'Services Manager';
    const isResolved = report?.resolved === true;
    
    const canEdit = (isCreator || isManager) && !isResolved;

    useEffect(() => {
        if (report) {
            form.reset({
                ...report,
                timeReported: formatDateTimeLocal(report.timeReported),
                timeArrived: formatDateTimeLocal(report.timeArrived),
                timeBackInService: formatDateTimeLocal(report.timeBackInService),
                timeLeftSite: formatDateTimeLocal(report.timeLeftSite),
                hasDelays: report.hasDelays || false,
                delayReason: report.delayReason || '',
            });
        }
    }, [report, form]);

    const handleSave = async (data: BreakdownForm) => {
        if (!firestore || !breakdownId) return;
        setIsSaving(true);

        // --- DATE VALIDATION START ---
        const reportedDate = data.timeReported ? new Date(data.timeReported) : null;
        const arrivedDate = data.timeArrived ? new Date(data.timeArrived) : null;
        const backInServiceDate = data.timeBackInService ? new Date(data.timeBackInService) : null;
        
        // Rule 1: You cannot arrive before the problem is reported
        if (arrivedDate && reportedDate && arrivedDate < reportedDate) {
            toast({
                variant: 'destructive',
                title: 'Timeline Error',
                description: "Technician 'Time Arrived' cannot be earlier than 'Time Reported'.",
            });
            setIsSaving(false);
            return; // Stop saving
        }

        // Rule 2: You cannot finish the job before you arrive
        if (backInServiceDate && arrivedDate && backInServiceDate < arrivedDate) {
            toast({
                variant: 'destructive',
                title: 'Timeline Error',
                description: "Time 'Back In Service' cannot be earlier than 'Time Arrived'.",
            });
            setIsSaving(false);
            return; // Stop saving
        }
        // --- DATE VALIDATION END ---
        
        const updateData = {
            ...data,
            updatedAt: serverTimestamp(),
            delayReason: data.hasDelays ? data.delayReason : null,
        }

        try {
            const breakdownRef = doc(firestore, 'breakdown_reports', breakdownId);
            await updateDoc(breakdownRef, updateData);

            // --- SYNC WITH EQUIPMENT ---
            if (data.equipmentId) {
                const equipmentRef = doc(firestore, 'equipment', data.equipmentId);
                const equipmentSnap = await getDoc(equipmentRef);
                if (equipmentSnap.exists()) {
                    const currentEq = equipmentSnap.data();

                    // 1. Calculate Downtime (in hours)
                    let additionalDowntime = 0;
                    if (data.timeArrived && data.timeBackInService) {
                        const start = new Date(data.timeArrived).getTime();
                        const end = new Date(data.timeBackInService).getTime();
                        const diffHours = (end - start) / (1000 * 60 * 60);
                        if (diffHours > 0) additionalDowntime = diffHours;
                    }
                    
                    // 2. CALCULATE NEXT DATE (The Fix)
                    const frequencyMonths = 3; // Default to 3 months
                    const completionDate = new Date(data.date);
                    const nextDueDate = new Date(completionDate);
                    nextDueDate.setMonth(completionDate.getMonth() + frequencyMonths);
                    const nextMaintenanceString = format(nextDueDate, "yyyy-MM-dd");

                    // 3. Update Equipment
                    await updateDoc(equipmentRef, {
                        breakdownStatus: data.resolved ? 'None' : 'Active',
                        status: data.resolved ? 'active' : 'maintenance',
                        totalDowntimeHours: (currentEq.totalDowntimeHours || 0) + additionalDowntime,
                        lastMaintenance: data.resolved ? data.date : currentEq.lastMaintenance,
                        nextMaintenance: data.resolved ? nextMaintenanceString : currentEq.nextMaintenance
                    });
                }
            }
            // --- END SYNC ---

            toast({ title: 'Success', description: 'Breakdown report updated.' });
            
            if (data.resolved) {
                router.refresh();
            }
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save changes.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const isLoading = isUserLoading || userDataLoading || reportLoading;

    if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    
    if (!report) {
        notFound();
        return null;
    }

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-8">
            <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Log
            </Button>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 bg-slate-50 rounded-t-lg">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    {report?.equipmentName || 'Breakdown Report'}
                                    {isResolved && <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1"/> Resolved</Badge>}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">Report ID: {breakdownId}</p>
                            </div>
                            
                            {!canEdit && (
                                <div className="flex items-center text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium border border-amber-200">
                                    <Lock className="w-3 h-3 mr-1" />
                                    {isResolved ? 'Resolved &amp; Locked' : 'View Only Mode'}
                                </div>
                            )}
                        </CardHeader>
                        
                        <CardContent className="p-6 space-y-6">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <Label>Fault Description</Label>
                                        <FormControl>
                                            <AutoFormatTextarea
                                                {...field}
                                                placeholder="Describe what went wrong, any error codes, or unusual behavior."
                                                disabled={!canEdit}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                             <FormField
                                control={form.control}
                                name="resolution"
                                render={({ field }) => (
                                <FormItem>
                                    <Label>Resolution Notes</Label>
                                    <FormControl>
                                        <AutoFormatTextarea
                                            placeholder="Describe how the issue was resolved..."
                                            {...field}
                                            value={field.value || ''}
                                            disabled={!canEdit}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Clock />Job Timeline &amp; Logistics</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="timeReported" render={({ field }) => (<FormItem><Label>Time Reported</Label><FormControl><Input type="datetime-local" {...field} disabled={!canEdit} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="timeArrived" render={({ field }) => (<FormItem><Label>Time Arrived On-Site</Label><FormControl><Input type="datetime-local" {...field} disabled={!canEdit} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="timeBackInService" render={({ field }) => (<FormItem><Label>Time Back in Service</Label><FormControl><Input type="datetime-local" {...field} disabled={!canEdit} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name="timeLeftSite" render={({ field }) => (<FormItem><Label>Time Left Site</Label><FormControl><Input type="datetime-local" {...field} disabled={!canEdit} /></FormControl></FormItem>)} />

                             <div className="md:col-span-2">
                                <FormField
                                    control={form.control}
                                    name="hasDelays"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <Label>Any Delays Encountered?</Label>
                                                <FormDescription>Check this if work was held up for any reason (e.g., waiting for parts, safety stand-down).</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                    disabled={!canEdit}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {hasDelays && (
                                <div className="md:col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="delayReason"
                                        render={({ field }) => (
                                        <FormItem>
                                            <Label>Reason for Delay</Label>
                                            <FormControl>
                                            <Textarea
                                                placeholder="Describe the cause of the delay..."
                                                className="resize-none"
                                                {...field}
                                                value={field.value || ''}
                                                disabled={!canEdit}
                                            />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {canEdit && (
                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>
                        </div>
                    )}
                </form>
            </Form>
        </div>
    );
}
