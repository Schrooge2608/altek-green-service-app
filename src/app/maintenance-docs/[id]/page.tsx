'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Save, Loader2, Printer, Pencil, Trash2, Lock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { AltekLogo } from '@/components/altek-logo';
import { useUser, useCollection, useMemoFirebase, useFirebase, useDoc } from '@/firebase';
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';
import type { User as AppUser } from '@/lib/types';

// Define Types
interface ScheduleData {
    id: string;
    userId: string;
    equipmentId: string;
    equipmentName: string;
    area: string;
    date: Date;
    inspectedBy: string;
    inspectedByUserId: string;
    signature: string | null;
    status: 'Scheduled' | 'Completed';
}

export default function SchedulePage() {
    const params = useParams(); 
    const router = useRouter();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user, isUserLoading } = useUser();
    
    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userData, isLoading: userDataLoading } = useDoc<AppUser>(userDocRef);

    // 1. DETERMINE IF NEW OR EXISTING
    const rawId = params?.id as string; 
    // If the ID is 'new', we are creating. Otherwise, we are viewing/editing.
    const isNewMode = !rawId || rawId === 'new';
    const scheduleId = isNewMode ? null : rawId;

    // 2. STATE
    const [isSaving, setIsSaving] = useState(false);
    const [signature, setSignature] = useState<string | null>(null);

    // 3. LOAD DATA
    const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
    const { data: equipmentList, isLoading: equipmentLoading } = useCollection<any>(equipmentQuery);

    const { data: scheduleData, isLoading: scheduleLoading } = useDoc<ScheduleData>(
        useMemoFirebase(() => scheduleId ? doc(firestore, 'upcoming_work', scheduleId) : null, [firestore, scheduleId])
    );

    // 4. SECURITY LOGIC
    // READ ONLY IF: File exists AND (I am not the creator AND I am not an Admin/Manager)
    const isCreator = isNewMode || (scheduleData?.userId === user?.uid);
    const isAdmin = userData?.role === 'Admin' || userData?.role === 'Superadmin' || userData?.role === 'Services Manager' || userData?.role === 'Site Supervisor' || userData?.role === 'Client Manager';
    const isReadOnly = !isNewMode && !isCreator && !isAdmin;

    // 5. FORM SETUP
    const form = useForm<ScheduleData>({
        defaultValues: {
            area: '',
            equipmentName: '',
            inspectedBy: '',
            date: new Date(),
        }
    });

    // 6. EFFECT: LOAD DATA OR SET DEFAULTS
    useEffect(() => {
        if (scheduleData && !isNewMode) {
            // --- EXISTING FILE: LOAD IT (Keep Original Name) ---
            form.reset({
                ...scheduleData,
                date: scheduleData.date ? new Date(scheduleData.date) : new Date(),
            });
            setSignature(scheduleData.signature || null);
        } else if (isNewMode && user && userData) {
            // --- NEW FILE: AUTO-FILL MY NAME ---
            // This ONLY runs if we are on /maintenance/new
            form.setValue('inspectedBy', userData.name || '');
            form.setValue('inspectedByUserId', user.uid);
            form.setValue('date', new Date());
        }
    }, [scheduleData, isNewMode, user, userData, form]);

    // 7. SAVE FUNCTION
    const handleSave = async (data: ScheduleData) => {
        if (!user || !firestore) return;
        setIsSaving(true);

        try {
            // Use existing ID or generate a new one
            const docId = scheduleId || `SCH-${Date.now()}`;
            const docRef = doc(firestore, 'upcoming_work', docId);

            const finalData = {
                ...data,
                id: docId,
                userId: scheduleData?.userId || user.uid, // Persist original owner
                signature: signature,
                status: signature ? 'Completed' : 'Scheduled',
                updatedAt: serverTimestamp(),
                date: data.date ? format(data.date, 'yyyy-MM-dd') : '',
            };

            await setDoc(docRef, finalData, { merge: true });
            
            toast({ title: 'Success', description: 'Schedule saved successfully.' });
            
            // If it was new, replace URL so we don't create duplicates on refresh
            if (isNewMode) {
                router.replace(`/maintenance/${docId}`);
            }
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save schedule.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isUserLoading || scheduleLoading || userDataLoading) {
        return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8">
            <div className="flex justify-end mb-4 gap-2 print:hidden">
                {isReadOnly ? (
                    <div className="flex items-center text-amber-600 bg-amber-50 px-4 py-2 rounded-md border border-amber-200">
                        <Lock className="mr-2 h-4 w-4" />
                        <span>View Only Mode (Owned by {scheduleData?.inspectedBy})</span>
                    </div>
                ) : (
                    <Button onClick={form.handleSubmit(handleSave)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Schedule
                    </Button>
                )}
                <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
            </div>

            <Card className="p-8 shadow-lg">
                <header className="flex items-start justify-between mb-8 border-b pb-4">
                    <AltekLogo className="h-10" />
                    <div className="text-right">
                        <h1 className="text-2xl font-bold tracking-tight text-primary">MAINTENANCE SCHEDULE</h1>
                        <p className="text-sm text-muted-foreground">VSD & Equipment Services</p>
                    </div>
                </header>

                <Form {...form}>
                    <form>
                        <fieldset disabled={isReadOnly} className="space-y-6">
                            
                            {/* --- EQUIPMENT SELECTION --- */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg border">
                                <FormField
                                    control={form.control}
                                    name="equipmentId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>Select Equipment</Label>
                                            <Select
                                                value={field.value}
                                                onValueChange={(val) => {
                                                    field.onChange(val);
                                                    const eq = equipmentList?.find((e: any) => e.id === val);
                                                    if (eq) {
                                                        form.setValue('equipmentName', eq.name);
                                                        form.setValue('area', eq.location);
                                                    }
                                                }}
                                                disabled={isReadOnly}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Choose Equipment..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {equipmentList?.map((eq: any) => (
                                                        <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="area"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>Area</Label>
                                            <FormControl>
                                                <Input {...field} placeholder="e.g. Mining" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <Label>Date</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                                        disabled={isReadOnly}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                                                </PopoverContent>
                                            </Popover>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="inspectedBy"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Label>Inspected By</Label>
                                            <FormControl>
                                                <Input {...field} readOnly className="bg-muted text-muted-foreground" />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* --- SIGNATURE SECTION (FIXED) --- */}
                            <div className="mt-8 border-t pt-6">
                                <Label className="text-lg font-semibold mb-4 block">Technician Signature</Label>
                                
                                {signature ? (
                                    /* STATE A: ALREADY SIGNED */
                                    <div className="relative border rounded-xl p-6 bg-white flex flex-col items-center justify-center w-full md:w-1/2">
                                        <img src={signature} alt="Technician Signature" className="h-24 object-contain" />
                                        <div className="text-xs text-green-600 font-medium mt-2 flex items-center">
                                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                            Digitally Signed by {scheduleData?.inspectedBy || userData?.name}
                                        </div>
                                        
                                        {!isReadOnly && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="absolute top-2 right-2 text-red-500 hover:bg-red-50"
                                                onClick={() => setSignature(null)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    /* STATE B: NOT SIGNED - SHOW BUTTON */
                                    <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 gap-4 w-full md:w-1/2">
                                        {userData?.signatureUrl ? (
                                            <Button
                                                type="button"
                                                size="lg"
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                                onClick={() => {
                                                    setSignature(userData.signatureUrl || '');
                                                    toast({ title: "Signed", description: "Signature applied successfully." });
                                                }}
                                                disabled={isReadOnly}
                                            >
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Click to Sign as {userData.name}
                                            </Button>
                                        ) : (
                                            <div className="text-center space-y-2">
                                                <p className="text-sm text-red-500">No signature found in your profile.</p>
                                                <Button 
                                                    variant="outline" 
                                                    onClick={() => router.push('/capture-signature')}
                                                    disabled={isReadOnly}
                                                >
                                                    Create Signature Now
                                                </Button>
                                            </div>
                                        )}
                                        
                                        {isReadOnly && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                <Lock className="inline h-3 w-3 mr-1" />
                                                Only the creator can sign this document.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                        </fieldset>
                    </form>
                </Form>
            </Card>
        </div>
    );
}