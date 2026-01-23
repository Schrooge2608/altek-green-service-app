'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, ArrowLeft, Lock, CheckCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useUser, useMemoFirebase, useFirebase, useDoc } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';
import type { Breakdown, User } from '@/lib/types';

// Let's use a type that is compatible with the main Breakdown type
type BreakdownForm = Breakdown & {
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    status: 'Open' | 'In Progress' | 'Resolved';
    reportedBy?: string; // Add this field
};

export default function BreakdownDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();
    
    // Correctly fetch userData
    const { data: userData, isLoading: userDataLoading } = useDoc<User>(
        useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
    );
    
    const breakdownId = params?.id as string;
    const [isSaving, setIsSaving] = useState(false);

    // 1. FETCH DATA from the correct collection 'breakdown_reports'
    const { data: report, isLoading: reportLoading } = useDoc<BreakdownForm>(
        useMemoFirebase(() => breakdownId ? doc(firestore, 'breakdown_reports', breakdownId) : null, [firestore, breakdownId])
    );

    // 2. FORM SETUP
    const form = useForm<BreakdownForm>({
        defaultValues: {
            equipmentName: '',
            description: '',
            priority: 'Medium',
            status: 'Open',
            reportedBy: '',
        }
    });

    // 3. SMART PERMISSIONS
    const isCreator = user?.uid === report?.userId;
    const isManager = userData?.role === 'Manager' || userData?.role === 'Admin' || userData?.role === 'Superadmin' || userData?.role === 'Services Manager';
    const isResolved = report?.status === 'Resolved' || report?.resolved === true;
    
    const canEdit = (isCreator || isManager) && !isResolved;

    // 4. LOAD DATA
    useEffect(() => {
        if (report) {
            // Map the boolean `resolved` to the string `status` if it exists
            const status = report.resolved ? 'Resolved' : (report.status || 'Open');
            form.reset({
                ...report,
                status: status as 'Open' | 'In Progress' | 'Resolved'
            });
        }
    }, [report, form]);

    // 5. SAVE FUNCTION
    const handleSave = async (data: BreakdownForm) => {
        if (!firestore || !breakdownId) return;
        setIsSaving(true);

        try {
            await setDoc(doc(firestore, 'breakdown_reports', breakdownId), {
                ...data,
                resolved: data.status === 'Resolved', // Keep `resolved` boolean in sync
                updatedAt: serverTimestamp(),
            }, { merge: true });

            toast({ title: 'Success', description: 'Breakdown report updated.' });
            
            if (data.status === 'Resolved') {
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

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-8">
            <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Log
            </Button>

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
                            {isResolved ? 'Resolved & Locked' : 'View Only Mode'}
                        </div>
                    )}
                </CardHeader>
                
                <CardContent className="p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="equipmentName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>Equipment</Label>
                                            <FormControl>
                                                <Input {...field} disabled={!canEdit} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="reportedBy"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>Reported By</Label>
                                            <FormControl>
                                                <Input {...field} disabled={true} className="bg-slate-100" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                
                                <FormField
                                    control={form.control}
                                    name="priority"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>Priority</Label>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Priority" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Low">Low</SelectItem>
                                                    <SelectItem value="Medium">Medium</SelectItem>
                                                    <SelectItem value="High">High</SelectItem>
                                                    <SelectItem value="Critical">Critical</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>Status</Label>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Open">Open</SelectItem>
                                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                                    <SelectItem value="Resolved">Resolved (Locks Report)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <Label>Fault Description</Label>
                                        <FormControl>
                                            <Textarea 
                                                {...field} 
                                                className="min-h-[120px]" 
                                                disabled={!canEdit} 
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {canEdit && (
                                <div className="flex justify-end pt-4 border-t">
                                    <Button type="submit" disabled={isSaving}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Changes
                                    </Button>
                                </div>
                            )}

                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
