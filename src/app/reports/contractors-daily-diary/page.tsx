'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { VoiceTextarea } from '@/components/ui/voice-textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { CalendarIcon, Printer, Save, Loader2, Pencil, Plus, Trash2, FileCheck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { AltekLogo } from '@/components/altek-logo';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, setDocumentNonBlocking, useUser, useCollection, useMemoFirebase, useFirebase, useDoc } from '@/firebase';
import { doc, collection, setDoc, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DailyDiary, User as AppUser, User, WorkEntry, PlantEntry, ManpowerEntry, Equipment } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AutoFormatTextarea } from '@/components/ui/auto-format-textarea';

export default function NewDailyDiaryPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { firestore, firebaseApp } = useFirebase();
    const { user, isUserLoading } = useUser();

    const diaryId = searchParams.get('id');
    const equipmentNameFromQuery = searchParams.get('equipmentName');

    const [uniqueId, setUniqueId] = useState('');
    const [isIdLoading, setIsIdLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [beforeFile, setBeforeFile] = useState<File | null>(null);
    const [afterFile, setAfterFile] = useState<File | null>(null);
    const [hseFile, setHseFile] = useState<File | null>(null);

    const [contractorSignature, setContractorSignature] = useState<string | null>(null);
    const [contractorName, setContractorName] = useState('');
    const [contractorDate, setContractorDate] = useState<Date>();

    const [clientSignature, setClientSignature] = useState<string | null>(null);
    const [clientName, setClientName] = useState('');
    const [clientDate, setClientDate] = useState<Date>();
    
    const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
    const { data: equipmentList, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

    const { data: diaryData, isLoading: diaryLoading } = useDoc<DailyDiary>(
        useMemoFirebase(() => diaryId ? doc(firestore, 'daily_diaries', diaryId) : null, [firestore, diaryId])
    );
    
    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

    const { data: userData, isLoading: userDataLoading } = useDoc<AppUser>(
        useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
    );

    const isManager = useMemo(() => {
        if (!userData?.role) return false;
        const managerRoles = ['Admin', 'Superadmin', 'Client Manager', 'Corporate Manager', 'Services Manager', 'Site Supervisor'];
        return managerRoles.some(role => userData.role.includes(role));
    }, [userData]);

    const isAdmin = useMemo(() => userData?.role && ['Admin', 'Superadmin'].includes(userData.role), [userData]);
    const isCreator = useMemo(() => diaryData?.userId === user?.uid, [diaryData, user]);

    const isSignedOff = diaryData?.isSignedOff || false;
    const canEdit = !isSignedOff && (isCreator || isAdmin);


    const defaultValues: Partial<DailyDiary> = {
        contractTitle: '',
        contractNumber: '',
        area: 'Mining',
        date: new Date(),
        shiftStart: '',
        shiftEnd: '',
        hrs: 0,
        incidents: '',
        toolboxTalk: '',
        manpower: [{ designation: '', forecast: 0, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' }],
        plant: [{ description: '', qty: 0, inspectionDone: 'no', comments: '' }],
        works: [{ area: '', scope: '', timeStart: '', timeEnd: '', hrs: 0 }],
        delays: [''],
        comments: [''],
        hseDocumentationScans: [],
        beforeWorkImages: [],
        afterWorkImages: [],
        isSignedOff: false,
    };

    const form = useForm<DailyDiary>({
        defaultValues,
    });
    
    const { fields: manpowerFields, append: appendManpower, remove: removeManpower } = useFieldArray({ control: form.control, name: "manpower" });
    const { fields: plantFields, append: appendPlant, remove: removePlant } = useFieldArray({ control: form.control, name: "plant" });
    const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({ control: form.control, name: "works" });

    const watchedArea = form.watch('area');
    const watchedLocation = form.watch('locationFilter');

    const locationOptions = useMemo(() => {
        if (!equipmentList || !watchedArea) return [];
        const filteredByPlant = equipmentList.filter(eq => eq.plant === watchedArea);
        return [...new Set(filteredByPlant.map(eq => eq.location))].sort().map(loc => ({
            value: loc,
            label: loc,
        }));
    }, [equipmentList, watchedArea]);


    const equipmentOptions = useMemo(() => {
        if (!watchedLocation || !equipmentList) return [];
        return equipmentList
            .filter(eq => eq.location === watchedLocation)
            .map(eq => ({ value: eq.id, label: eq.name }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [watchedLocation, equipmentList]);

    const onEquipmentSelectChange = (equipmentId: string) => {
        form.setValue('savedEquipmentId', equipmentId);
        const equipment = equipmentList?.find(eq => eq.id === equipmentId);
        if (equipment) {
            form.setValue('works.0.scope', `Unscheduled work on: ${equipment.name}`);
            form.setValue('works.0.area', equipment.location);
        }
    }

    useEffect(() => {
        if (diaryId && diaryData) {
            // --- EDIT MODE: Load Saved Data ---
            form.reset({
                ...defaultValues, // Fallback for missing fields
                ...diaryData,     // Overwrite with saved data
                
                // DATA RECOVERY: If saved array is empty, give 1 empty line. If it has data, KEEP IT.
                manpower: (diaryData.manpower && diaryData.manpower.length > 0) 
                          ? diaryData.manpower 
                          : defaultValues.manpower,

                plant: (diaryData.plant && diaryData.plant.length > 0) 
                          ? diaryData.plant 
                          : defaultValues.plant,

                works: (diaryData.works && diaryData.works.length > 0) 
                          ? diaryData.works 
                          : defaultValues.works,

                // DATE HANDLING
                date: diaryData.date ? new Date(diaryData.date) : new Date(),
                locationFilter: diaryData.locationFilter || (diaryData.works && diaryData.works[0]?.area) || '',
                savedEquipmentId: diaryData.savedEquipmentId || '',
            });

            // Restore Signatures & Local State
            setContractorSignature(diaryData.contractorSignature || null);
            setClientSignature(diaryData.clientSignature || null);
            setContractorName(diaryData.contractorName || '');
            setClientName(diaryData.clientName || '');
            setContractorDate(diaryData.contractorDate ? new Date(diaryData.contractorDate) : undefined);
            setClientDate(diaryData.clientDate ? new Date(diaryData.clientDate) : undefined);

        } else if (!diaryId) {
            // --- NEW MODE: Force Clean Slate ---
            form.reset(defaultValues);
            
            // Wipe all local state
            setContractorSignature(null);
            setClientSignature(null);
            setContractorName('');
            setClientName('');
            setContractorDate(undefined);
            setClientDate(undefined);
            setBeforeFile(null);
            setAfterFile(null);
            setHseFile(null);
        }
    }, [diaryId, diaryData, form]);
    
    useEffect(() => {
        if (diaryId) {
            setUniqueId(diaryId);
            setIsIdLoading(false);
        } else {
            setIsIdLoading(true);
            const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
            setUniqueId(`AG-RBM-DD-${randomPart}`);
            setIsIdLoading(false);
        }
    }, [diaryId]);

    const handleApprove = async () => {
        // 1. Check if User has a signature on file
        if (!userData?.signatureUrl) {
            toast({
                variant: "destructive",
                title: "Signature Required",
                description: "You must upload your digital signature before approving.",
            });
            // Redirect to Signature Page
            router.push('/capture-signature');
            return;
        }

        // 2. Apply Signature & Lock the Form
        setClientSignature(userData.signatureUrl);
        if (!clientName) setClientName(userData.name || '');
        setClientDate(new Date());

        // We need to trigger a save with the approval flag
        form.handleSubmit((data) => handleSave(data, true))();
    };


    const handleDeleteImage = async (imageUrl: string, imageType: 'beforeWorkImages' | 'afterWorkImages' | 'hseDocumentationScans') => {
        if (!diaryId || !firebaseApp) {
            toast({ variant: "destructive", title: "Error", description: "Diary not loaded or Firebase not available." });
            return;
        }
        setIsSaving(true);
        try {
            const storage = getStorage(firebaseApp);
            const imageRef = ref(storage, imageUrl);
            await deleteObject(imageRef);
            const diaryRef = doc(firestore, 'daily_diaries', diaryId);
            const currentImages = diaryData?.[imageType] || [];
            const updatedImages = currentImages.filter(url => url !== imageUrl);
            await updateDoc(diaryRef, { [imageType]: updatedImages });
            toast({ title: "Image Deleted", description: "The selected image has been removed." });
            router.refresh();
        } catch (error: any) {
            console.error("Failed to delete image:", error);
            toast({ variant: "destructive", title: "Deletion Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async (data: DailyDiary, isApprovalAction = false) => {
        if (!firestore || !uniqueId || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not logged in or database not available.' });
            return;
        }

        setIsSaving(true);
        try {
            const storage = getStorage(firebaseApp);
            const diaryDocRef = doc(firestore, 'daily_diaries', uniqueId);
            
            const finalIsFinalised = isApprovalAction ? true : (diaryData?.isFinalised || false);

            const finalDiaryData: Partial<DailyDiary> = { 
                id: uniqueId,
                userId: user.uid,
                contractTitle: data.contractTitle || 'VSD MAINTENANCE',
                contractNumber: data.contractNumber || 'CW 22038313',
                area: data.area || 'Mining',
                date: data.date ? format(new Date(data.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                shiftStart: data.shiftStart || '',
                shiftEnd: data.shiftEnd || '',
                hrs: data.hrs || 0,
                incidents: data.incidents || '',
                toolboxTalk: data.toolboxTalk || '',
                locationFilter: data.locationFilter || null,
                savedEquipmentId: data.savedEquipmentId || null,
                
                manpower: (data.manpower || []).map(m => ({
                    designation: m.designation || '',
                    forecast: m.forecast || 0,
                    actual: m.actual || 0,
                    normalHrs: m.normalHrs || 0,
                    overtime1_5: m.overtime1_5 || 0,
                    overtime2_0: m.overtime2_0 || 0,
                    totalManHrs: m.totalManHrs || 0,
                    comments: m.comments || '',
                })),
                plant: (data.plant || []).map(p => ({
                    description: p.description || '',
                    qty: p.qty || 0,
                    inspectionDone: p.inspectionDone || 'no',
                    comments: p.comments || '',
                })),
                works: (data.works || []).map(w => ({
                    area: w.area || '',
                    scope: w.scope || '',
                    timeStart: w.timeStart || '',
                    timeEnd: w.timeEnd || '',
                    hrs: w.hrs || 0,
                })),
                delays: (data.delays || []).map(d => d || ''),
                comments: (data.comments || []).map(c => c || ''),
                createdAt: diaryData?.createdAt || serverTimestamp(),
                beforeWorkImages: diaryData?.beforeWorkImages || [],
                afterWorkImages: diaryData?.afterWorkImages || [],
                hseDocumentationScans: diaryData?.hseDocumentationScans || [],
                
                contractorSignature: contractorSignature || null,
                contractorName: contractorName || '',
                contractorDate: contractorDate ? format(contractorDate, 'yyyy-MM-dd') : '',

                clientSignature: clientSignature || null,
                clientName: clientName || '',
                clientDate: clientDate ? format(clientDate, 'yyyy-MM-dd') : '',
                
                isSignedOff: finalIsFinalised ? true : (diaryData?.isSignedOff || !!contractorSignature),
                isFinalised: finalIsFinalised,
            };

            if (beforeFile) {
                const fileRef = ref(storage, `daily_diaries/${uniqueId}/before/${beforeFile.name}_${Date.now()}`);
                await uploadBytes(fileRef, beforeFile);
                const downloadUrl = await getDownloadURL(fileRef);
                finalDiaryData.beforeWorkImages?.push(downloadUrl);
            }
            if (afterFile) {
                const fileRef = ref(storage, `daily_diaries/${uniqueId}/after/${afterFile.name}_${Date.now()}`);
                await uploadBytes(fileRef, afterFile);
                const downloadUrl = await getDownloadURL(fileRef);
                finalDiaryData.afterWorkImages?.push(downloadUrl);
            }
            if (hseFile) {
                const fileRef = ref(storage, `daily_diaries/${uniqueId}/hse/${hseFile.name}_${Date.now()}`);
                await uploadBytes(fileRef, hseFile);
                const downloadUrl = await getDownloadURL(fileRef);
                finalDiaryData.hseDocumentationScans?.push(downloadUrl);
            }

            await setDoc(diaryDocRef, finalDiaryData, { merge: true });

            // --- AUTO-SCHEDULE LOGIC ---
            if (data.savedEquipmentId) {
                const equipmentRef = doc(firestore, 'equipment', data.savedEquipmentId);
                const equipmentSnap = await getDoc(equipmentRef);
                if (equipmentSnap.exists()) {
                    const currentEq = equipmentSnap.data() as Equipment;
                    const workDate = new Date(data.date || new Date());
                    const frequency = 3; // Default to 3 months
                    const nextDueDate = new Date(workDate);
                    nextDueDate.setMonth(nextDueDate.getMonth() + frequency);
                    const nextDateString = format(nextDueDate, 'yyyy-MM-dd');
                    await updateDoc(equipmentRef, {
                        lastMaintenance: format(workDate, 'yyyy-MM-dd'),
                        nextMaintenance: nextDateString,
                        status: 'active'
                    });
                    router.refresh();
                }
            }
            // --- END AUTO-SCHEDULE LOGIC ---
            
            if (isApprovalAction) {
                 toast({ title: 'Approved', description: `Diary ${uniqueId} has been successfully approved and signed.` });
            } else {
                 toast({ title: 'Saved', description: `Diary ${uniqueId} saved.` });
            }
            
            router.push(`/reports/diary-tracker`);
        } catch (error: any) {
            console.error("Failed to save diary:", error);
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isUserLoading || diaryLoading || userDataLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2">Loading Diary...</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-background">
            <div className="flex justify-end mb-4 gap-2 print:hidden">
                {!diaryData?.isFinalised && (isManager || isAdmin) && !isCreator ? (
                    <Button 
                        onClick={handleApprove} 
                        disabled={isSaving || !diaryData?.isSignedOff}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
                        Approve Diary
                    </Button>
                ) : (
                    <Button 
                        onClick={form.handleSubmit((data) => handleSave(data, false))} 
                        disabled={!uniqueId || isIdLoading || isSaving || diaryData?.isFinalised}
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isSaving ? 'Saving...' : 'Save Progress'}
                    </Button>
                )}
                <Button onClick={() => window.print()} variant="outline">
                    <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
            </div>


            <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => handleSave(data, false))}>
                <fieldset disabled={diaryData?.isFinalised}>
                    <Card className="p-8 shadow-lg" id="diary-form">
                        <header className="flex items-start justify-between mb-4 border-b pb-4">
                            <AltekLogo className="h-10" />
                            <div className="text-right">
                                <h1 className="text-2xl font-bold tracking-tight text-primary">{diaryId ? 'Edit Daily Diary' : 'DAILY DIARY'}</h1>
                                <p className="text-sm text-muted-foreground font-mono">ID: {isIdLoading ? 'Generating...' : uniqueId}</p>
                            </div>
                        </header>

                        <Card className="mb-4">
                            <CardHeader className="bg-muted p-2 rounded-t-lg">
                                <CardTitle className="text-sm">SELECT EQUIPMENT (OPTIONAL)</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                <FormField
                                    control={form.control}
                                    name="locationFilter"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1">
                                            <Label>Location</Label>
                                            <Select 
                                                key={`loc-${equipmentList?.length || 0}`} 
                                                onValueChange={field.onChange} 
                                                value={field.value || ''} 
                                                disabled={equipmentLoading || !canEdit}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Location..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {equipmentLoading ? 
                                                        <SelectItem value="loading" disabled>Loading locations...</SelectItem> : 
                                                        locationOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)
                                                    }
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="savedEquipmentId"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1">
                                            <Label>Equipment Name</Label>
                                            <Select 
                                                key={`eq-${equipmentList?.length || 0}-${watchedLocation}`} 
                                                onValueChange={(val) => {
                                                    field.onChange(val);
                                                    onEquipmentSelectChange(val);
                                                }}
                                                value={field.value || ''}
                                                disabled={!watchedLocation || equipmentLoading || !canEdit}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Equipment..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {equipmentLoading || !watchedLocation ? 
                                                        <SelectItem value="loading" disabled>Select a location first...</SelectItem> : 
                                                        equipmentOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)
                                                    }
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Form fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 text-sm items-end">
                        <FormField
                                control={form.control}
                                name="contractTitle"
                                render={({ field }) => (
                                    <FormItem className="lg:col-span-2 grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                            <FormLabel>Contract Title</FormLabel>
                                            <FormControl>
                                            <Input id="contract-title" {...field} />
                                            </FormControl>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="contractNumber"
                                        render={({ field: fieldNum }) => (
                                            <FormItem>
                                                <FormLabel>Contract Number</FormLabel>
                                                <FormControl>
                                                <Input id="contract-number" {...fieldNum} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="area"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                        <FormLabel>Area</FormLabel>
                                        <FormControl>
                                        <RadioGroup 
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                                form.setValue('locationFilter', '');
                                                form.setValue('savedEquipmentId', '');
                                            }}
                                            value={field.value} 
                                            className="flex gap-4 pt-2"
                                        >
                                            <FormItem className="flex items-center space-x-2">
                                                <FormControl>
                                                    <RadioGroupItem value="Mining" id="mining" />
                                                </FormControl>
                                                <FormLabel htmlFor="mining">Mining</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2">
                                                <FormControl>
                                                    <RadioGroupItem value="Smelter" id="smelter" />
                                                </FormControl>
                                                <FormLabel htmlFor="smelter">Smelter</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                    <FormLabel>Date</FormLabel>
                                    <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                                            </Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                    </Popover>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                            <FormField
                                control={form.control}
                                name="shiftStart"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                        <FormLabel>Shift Start</FormLabel>
                                        <FormControl>
                                        <Input id="shift-start" type="time" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="shiftEnd"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                        <FormLabel>Shift End</FormLabel>
                                        <FormControl>
                                        <Input id="shift-end" type="time" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="hrs"
                                render={({ field }) => (
                                    <FormItem className="space-y-1">
                                        <FormLabel>Hrs</FormLabel>
                                        <FormControl>
                                        <Input id="hrs" type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} value={field.value ?? ''} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Card className="mb-4">
                            <CardHeader className="bg-muted p-2 rounded-t-lg">
                                <CardTitle className="text-sm">SECTION A: HSE</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                <FormField
                                    control={form.control}
                                    name="incidents"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1">
                                            <FormLabel>Incidents/Accidents/Injuries</FormLabel>
                                            <FormControl>
                                            <VoiceTextarea id="incidents" rows={2} {...field} onChange={field.onChange} value={field.value ?? ''} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="toolboxTalk"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1">
                                            <FormLabel>Toolbox Talk</FormLabel>
                                            <FormControl>
                                            <VoiceTextarea id="toolbox-talk" rows={2} {...field} onChange={field.onChange} value={field.value ?? ''} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <div className="space-y-2 pt-2">
                                    <Label className="font-semibold" htmlFor="hse-file-input">HSE Documentation (Take 5, etc.)</Label>
                                    <Input 
                                        id="hse-file-input"
                                        type="file" 
                                        accept="image/*,application/pdf"
                                        onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setHseFile(e.target.files[0]);
                                        }
                                        }}
                                        className="w-full p-2 border rounded"
                                    />
                                    {hseFile && <p className="text-green-600 text-sm mt-1">File Selected: {hseFile.name}</p>}
                                    {diaryData?.hseDocumentationScans && diaryData.hseDocumentationScans.length > 0 && (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {diaryData.hseDocumentationScans.map((url, index) => (
                                        <div key={index} className="relative group">
                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                            <img 
                                                src={url} 
                                                alt={`HSE Doc ${index + 1}`} 
                                                className="h-20 w-20 object-cover rounded border border-gray-300 bg-gray-100"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/100?text=PDF' }} 
                                            />
                                            </a>
                                             <Button
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDeleteImage(url, 'hseDocumentationScans')}
                                                disabled={isSaving || !canEdit}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        ))}
                                    </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader className="bg-muted p-2 rounded-t-lg flex flex-row items-center justify-between">
                                <CardTitle className="text-sm">SECTION B: MANPOWER AND PLANT</CardTitle>
                                {canEdit && <Button size="sm" type="button" onClick={() => appendManpower({ designation: '', forecast: 1, actual: 1, normalHrs: 9, overtime1_5: 0, overtime2_0: 0, totalManHrs: 9, comments: '' })}><Plus className="mr-2 h-4 w-4"/>Add Manpower</Button>}
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[200px]">Designation</TableHead>
                                            <TableHead>Forecast</TableHead>
                                            <TableHead>Actual</TableHead>
                                            <TableHead>Normal</TableHead>
                                            <TableHead>1.5 OT</TableHead>
                                            <TableHead>2.0 OT</TableHead>
                                            <TableHead>Total</TableHead>
                                            <TableHead>Comments</TableHead>
                                            {canEdit && <TableHead />}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {manpowerFields.map((field, index) => (
                                            <TableRow key={field.id}>
                                                <TableCell><Input {...form.register(`manpower.${index}.designation`)}/></TableCell>
                                                <TableCell><Input type="number" {...form.register(`manpower.${index}.forecast`, { valueAsNumber: true })}/></TableCell>
                                                <TableCell><Input type="number" {...form.register(`manpower.${index}.actual`, { valueAsNumber: true })}/></TableCell>
                                                <TableCell><Input type="number" step="0.1" {...form.register(`manpower.${index}.normalHrs`, { valueAsNumber: true })}/></TableCell>
                                                <TableCell><Input type="number" step="0.1" {...form.register(`manpower.${index}.overtime1_5`, { valueAsNumber: true })}/></TableCell>
                                                <TableCell><Input type="number" step="0.1" {...form.register(`manpower.${index}.overtime2_0`, { valueAsNumber: true })}/></TableCell>
                                                <TableCell><Input type="number" {...form.register(`manpower.${index}.totalManHrs`, { valueAsNumber: true })} readOnly className="bg-muted"/></TableCell>
                                                <TableCell><Input {...form.register(`manpower.${index}.comments`)}/></TableCell>
                                                {canEdit && <TableCell><Button variant="ghost" size="icon" type="button" onClick={() => removeManpower(index)}><Trash2 className="h-4 w-4"/></Button></TableCell>}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {canEdit && <Button size="sm" type="button" onClick={() => appendPlant({ description: '', qty: 1, inspectionDone: 'no', comments: '' })}><Plus className="mr-2 h-4 w-4"/>Add Plant</Button>}
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Plant description</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Daily Inspection Done</TableHead>
                                            <TableHead>Comments</TableHead>
                                            {canEdit && <TableHead />}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {plantFields.map((field, index) => (
                                            <TableRow key={field.id}>
                                                <TableCell><Input {...form.register(`plant.${index}.description`)}/></TableCell>
                                                <TableCell><Input type="number" {...form.register(`plant.${index}.qty`, { valueAsNumber: true })}/></TableCell>
                                                <TableCell>
                                                    <Controller
                                                        control={form.control}
                                                        name={`plant.${index}.inspectionDone`}
                                                        render={({ field: radioField }) => (
                                                            <RadioGroup className="flex gap-4" onValueChange={radioField.onChange} value={radioField.value}>
                                                                <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id={`plant-y-${index}`} /><Label htmlFor={`plant-y-${index}`}>Y</Label></div>
                                                                <div className="flex items-center space-x-2"><RadioGroupItem value="no" id={`plant-n-${index}`} /><Label htmlFor={`plant-n-${index}`}>N</Label></div>
                                                            </RadioGroup>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell><Input {...form.register(`plant.${index}.comments`)}/></TableCell>
                                                {canEdit && <TableCell><Button variant="ghost" size="icon" type="button" onClick={() => removePlant(index)}><Trash2 className="h-4 w-4"/></Button></TableCell>}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader className="bg-muted p-2 rounded-t-lg flex flex-row items-center justify-between">
                                <CardTitle className="text-sm">SECTION C: DESCRIPTION OF WORKS</CardTitle>
                                {canEdit && <Button size="sm" type="button" onClick={() => appendWork({ area: '', scope: '', timeStart: '', timeEnd: '', hrs: 0 })}><Plus className="mr-2 h-4 w-4"/>Add Work</Button>}
                            </CardHeader>
                            <CardContent className="p-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Area of Work</TableHead>
                                            <TableHead className="w-[40%]">Scope of Work</TableHead>
                                            <TableHead>Time Start</TableHead>
                                            <TableHead>Time End</TableHead>
                                            <TableHead>Hrs</TableHead>
                                            {canEdit && <TableHead />}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {workFields.map((field, index) => (
                                            <TableRow key={field.id}>
                                                <TableCell><Input {...form.register(`works.${index}.area`)}/></TableCell>
                                                <TableCell>
                                                    <Controller
                                                        control={form.control}
                                                        name={`works.${index}.scope`}
                                                        render={({ field }) => (
                                                            <AutoFormatTextarea
                                                                {...field}
                                                                value={field.value || ''}
                                                                placeholder="Describe scope of work..."
                                                            />
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell><Input type="time" {...form.register(`works.${index}.timeStart`)}/></TableCell>
                                                <TableCell><Input type="time" {...form.register(`works.${index}.timeEnd`)}/></TableCell>
                                                <TableCell><Input type="number" className="w-[70px]" {...form.register(`works.${index}.hrs`, { valueAsNumber: true })}/></TableCell>
                                                {canEdit && <TableCell><Button variant="ghost" size="icon" type="button" onClick={() => removeWork(index)}><Trash2 className="h-4 w-4"/></Button></TableCell>}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="mb-4">
                                <CardHeader className="bg-muted p-2 rounded-t-lg">
                                    <CardTitle className="text-sm">SECTION D: DELAYS</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-2">
                                    {form.getValues().delays?.map((_, index) => (
                                        <FormField
                                            key={index}
                                            control={form.control}
                                            name={`delays.${index}`}
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-2">
                                                    <FormLabel className="w-6 shrink-0">{index + 1}.</FormLabel>
                                                    <FormControl>
                                                    <Textarea rows={1} {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="mb-4">
                                <CardHeader className="bg-muted p-2 rounded-t-lg">
                                    <CardTitle className="text-sm">SECTION E: COMMENTS</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-2">
                                    {form.getValues().comments?.map((_, index) => (
                                        <FormField
                                            key={index}
                                            control={form.control}
                                            name={`comments.${index}`}
                                            render={({ field }) => (
                                                <FormItem className="flex items-center gap-2">
                                                    <FormLabel className="w-6 shrink-0">{index + 1}.</FormLabel>
                                                    <FormControl>
                                                    <Textarea rows={1} {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader className="bg-muted p-2 rounded-t-lg">
                                <CardTitle className="text-sm">SECTION F: GALLERY</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor='before-file-input' className="font-semibold">Before Work</Label>
                                    <Input 
                                        id='before-file-input'
                                        type="file" 
                                        accept="image/*,application/pdf"
                                        onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setBeforeFile(e.target.files[0]);
                                        }
                                        }}
                                        className="w-full p-2 border rounded"
                                    />
                                    {beforeFile && <p className="text-green-600 text-sm mt-1">File Selected: {beforeFile.name}</p>}
                                    {diaryData?.beforeWorkImages && diaryData.beforeWorkImages.length > 0 && (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {diaryData.beforeWorkImages.map((url, index) => (
                                        <div key={index} className="relative group">
                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                <img src={url} alt={`Before Work ${index + 1}`} className="h-24 w-24 object-cover rounded border border-gray-300" />
                                            </a>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDeleteImage(url, 'beforeWorkImages')}
                                                disabled={isSaving || !canEdit}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        ))}
                                    </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor='after-file-input' className="font-semibold">After Work</Label>
                                     <Input 
                                        id='after-file-input'
                                        type="file" 
                                        accept="image/*,application/pdf"
                                        onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setAfterFile(e.target.files[0]);
                                        }
                                        }}
                                        className="w-full p-2 border rounded"
                                    />
                                    {afterFile && <p className="text-green-600 text-sm mt-1">File Selected: {afterFile.name}</p>}
                                    {diaryData?.afterWorkImages && diaryData.afterWorkImages.length > 0 && (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {diaryData.afterWorkImages.map((url, index) => (
                                        <div key={index} className="relative group">
                                            <a href={url} target="_blank" rel="noopener noreferrer">
                                                <img src={url} alt={`After Work ${index + 1}`} className="h-24 w-24 object-cover rounded border border-gray-300" />
                                            </a>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDeleteImage(url, 'afterWorkImages')}
                                                disabled={isSaving || !canEdit}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        ))}
                                    </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card>
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base text-center">CONTRACTOR</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="space-y-1">
                                        <Label>Name</Label>
                                        <Input 
                                            value={contractorName} 
                                            onChange={(e) => setContractorName(e.target.value)} 
                                            disabled={!canEdit || diaryData?.isFinalised} 
                                            placeholder="Contractor Name"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Signature</Label>
                                        {contractorSignature ? (
                                            <div className="relative border rounded-md p-4 bg-white flex flex-col items-center">
                                                <img src={contractorSignature} alt="Contractor Sig" className="h-24 object-contain" />
                                                {canEdit && !diaryData?.isFinalised && (isAdmin || isCreator) && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="absolute top-1 right-1 h-6 w-6 p-0 text-red-500 hover:bg-red-50" 
                                                        onClick={() => setContractorSignature(null)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center bg-slate-50 gap-3">
                                                {(isCreator || isAdmin) ? (
                                                    <Button 
                                                        type="button" 
                                                        variant="default" 
                                                        disabled={!canEdit || diaryData?.isFinalised}
                                                        className="w-full"
                                                        onClick={() => {
                                                            if (userData?.signatureUrl) {
                                                                setContractorSignature(userData.signatureUrl);
                                                                if (!contractorName) setContractorName(userData.name || '');
                                                                setContractorDate(new Date());
                                                            } else {
                                                                toast({ variant: "destructive", title: "No Signature", description: "Please create a signature in your profile first." });
                                                                router.push('/capture-signature');
                                                            }
                                                        }}
                                                    >
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Click to Sign as {userData?.name}
                                                    </Button>
                                                ) : (
                                                    <div className="text-center text-muted-foreground py-2">
                                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-20" />
                                                        <p className="text-sm">Waiting for Contractor</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant={"outline"} disabled={!canEdit || diaryData?.isFinalised} className={cn("w-full justify-start text-left font-normal", !contractorDate && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {contractorDate ? format(contractorDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={contractorDate} onSelect={setContractorDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base text-center">CLIENT / MANAGER</CardTitle>
                                </CardHeader>
                                 <CardContent className="p-4 space-y-4">
                                    <div className="space-y-1">
                                        <Label>Name</Label>
                                        <Input 
                                            value={clientName} 
                                            onChange={(e) => setClientName(e.target.value)} 
                                            disabled={diaryData?.isFinalised} 
                                            placeholder="Client Representative Name"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Signature</Label>
                                        {clientSignature ? (
                                            <div className="relative border rounded-md p-4 bg-white flex flex-col items-center">
                                                <img src={clientSignature} alt="Client Sig" className="h-24 object-contain" />
                                                {!diaryData?.isFinalised && (isManager || isAdmin) && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="absolute top-1 right-1 h-6 w-6 p-0 text-red-500 hover:bg-red-50" 
                                                        onClick={() => setClientSignature(null)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center bg-slate-50 gap-3">
                                                {(isManager || isAdmin) ? (
                                                    userData?.signatureUrl ? (
                                                        <Button 
                                                            type="button" 
                                                            variant="default" 
                                                            disabled={diaryData?.isFinalised}
                                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                                            onClick={() => {
                                                                setClientSignature(userData.signatureUrl);
                                                                if (!clientName) setClientName(userData.name || '');
                                                                setClientDate(new Date());
                                                                toast({ title: "Signature Applied", description: "Client signature applied." });
                                                            }}
                                                        >
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Click to Sign as {userData.name}
                                                        </Button>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 w-full">
                                                            <p className="text-sm text-red-500 font-medium text-center">
                                                                No signature found.
                                                            </p>
                                                            <Button 
                                                                type="button" 
                                                                variant="outline" 
                                                                className="w-full border-red-200 text-red-600 hover:bg-red-50"
                                                                onClick={() => router.push('/capture-signature')}
                                                            >
                                                                Create Signature
                                                            </Button>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="text-center text-muted-foreground py-2">
                                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 opacity-20" />
                                                        <p className="text-sm">Awaiting Manager</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant={"outline"} disabled={diaryData?.isFinalised} className={cn("w-full justify-start text-left font-normal", !clientDate && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {clientDate ? format(clientDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={clientDate} onSelect={setClientDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </Card>
                </fieldset>
            </form>
            </Form>
        </div>
    );
}
