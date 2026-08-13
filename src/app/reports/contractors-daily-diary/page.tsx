'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Printer, Save, Loader2, Plus, Trash2, FileCheck, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { useFieldArray, useForm, Controller, useWatch } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useFirestore, useUser, useCollection, useMemoFirebase, useFirebase, useDoc } from '@/firebase';
import { doc, collection, setDoc, serverTimestamp, updateDoc, getDoc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DailyDiary, User as AppUser, User, Equipment } from '@/lib/types';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { extractDailyDiaryData } from '@/ai/flows/extract-daily-diary-flow';

export default function NewDailyDiaryV2Page() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { firestore, firebaseApp } = useFirebase();
    const { user, isUserLoading } = useUser();

    const diaryId = searchParams.get('id');

    const [uniqueId, setUniqueId] = useState('');
    const [isIdLoading, setIsIdLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const [contractorSignature, setContractorSignature] = useState<string | null>(null);
    const [contractorName, setContractorName] = useState('');
    const [contractorDate, setContractorDate] = useState<Date | undefined>();

    const [clientSignature, setClientSignature] = useState<string | null>(null);
    const [clientName, setClientName] = useState('');
    const [clientDate, setClientDate] = useState<Date | undefined>();

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

    const nameOptions = useMemo(() => {
        if (!users) return [];
        const uniqueNames = Array.from(new Set(users.map(u => u.name).filter(Boolean)));
        return uniqueNames.map(name => ({ label: name!, value: name! }));
    }, [users]);

    const isManager = useMemo(() => {
        if (!userData?.role) return false;
        const managerRoles = ['Admin', 'Superadmin', 'Client Manager', 'Corporate Manager', 'Services Manager', 'Site Supervisor'];
        return managerRoles.some(role => userData.role.includes(role));
    }, [userData]);

    const isAdmin = useMemo(() => userData?.role && ['Admin', 'Superadmin'].includes(userData.role), [userData]);
    const isCreator = useMemo(() => !diaryId || (diaryData?.userId === user?.uid), [diaryId, diaryData, user]);
    const isSignedOff = diaryData?.isSignedOff || false;
    const canEdit = !isSignedOff && (isCreator || isAdmin);

    const defaultValues: Partial<DailyDiary> = {
        contractTitle: 'VSD MAINTENANCE',
        contractNumber: 'CW 22038313',
        area: 'Mining',
        date: new Date(),
        shiftStart: '',
        shiftEnd: '',
        hrs: 0,
        incidents: '',
        toolboxTalk: '',
        manpower: [{ designation: '', forecast: 0, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' }],
        plant: [{ description: '', qty: 0, inspectionDone: 'yes', comments: '' }],
        works: [{ area: '', scope: '', timeStart: '', timeEnd: '', hrs: 0 }],
        delays: ['', '', '', '', ''], // 5 default
        comments: ['', '', '', '', ''], // 5 default
    };

    const form = useForm<DailyDiary>({ defaultValues });
    const { fields: manpowerFields, append: appendManpower, remove: removeManpower } = useFieldArray({ control: form.control, name: "manpower" });
    const { fields: plantFields, append: appendPlant, remove: removePlant } = useFieldArray({ control: form.control, name: "plant" });
    const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({ control: form.control, name: "works" });
    
    // Convert 5 delays and comments array specifically
    const watchedDelays = useWatch({ control: form.control, name: 'delays' }) || [];
    const watchedComments = useWatch({ control: form.control, name: 'comments' }) || [];

    const watchedShiftStart = useWatch({ control: form.control, name: 'shiftStart' });
    const watchedShiftEnd = useWatch({ control: form.control, name: 'shiftEnd' });
    const watchedManpower = useWatch({ control: form.control, name: 'manpower' });
    const watchedArea = useWatch({ control: form.control, name: 'area' });

    // Auto-calculate main shift hours
    useEffect(() => {
        if (watchedShiftStart && watchedShiftEnd) {
            const [startH, startM] = watchedShiftStart.split(':').map(Number);
            const [endH, endM] = watchedShiftEnd.split(':').map(Number);
            if (!isNaN(startH) && !isNaN(startM) && !isNaN(endH) && !isNaN(endM)) {
                let startMinutes = startH * 60 + startM;
                let endMinutes = endH * 60 + endM;
                if (endMinutes < startMinutes) endMinutes += 24 * 60;
                const diffHours = (endMinutes - startMinutes) / 60;
                form.setValue('hrs', parseFloat(diffHours.toFixed(2)));
            }
        }
    }, [watchedShiftStart, watchedShiftEnd, form]);

    // Auto-calculate manpower row totals
    useEffect(() => {
        if (watchedManpower) {
            watchedManpower.forEach((m, index) => {
                const normal = parseFloat(String(m?.normalHrs || 0)) || 0;
                const ot1_5 = parseFloat(String(m?.overtime1_5 || 0)) || 0;
                const ot2_0 = parseFloat(String(m?.overtime2_0 || 0)) || 0;
                const total = normal + ot1_5 + ot2_0;
                if (form.getValues(`manpower.${index}.totalManHrs`) !== total) {
                    form.setValue(`manpower.${index}.totalManHrs`, total);
                }
            });
        }
    }, [watchedManpower, form]);

    useEffect(() => {
        if (diaryId && diaryData) {
            const defaults = { ...defaultValues, ...diaryData };
            // Ensure strictly 5 delays/comments if less, or more if already more
            const safeDelays = [...(diaryData.delays || [])];
            while (safeDelays.length < 5) safeDelays.push('');
            const safeComments = [...(diaryData.comments || [])];
            while (safeComments.length < 5) safeComments.push('');
            
            form.reset({
                ...defaults,
                delays: safeDelays,
                comments: safeComments,
                date: diaryData.date ? new Date(diaryData.date as string) : new Date(),
            });
            setContractorSignature(diaryData.contractorSignature || null);
            setClientSignature(diaryData.clientSignature || null);
            setContractorName(diaryData.contractorName || '');
            setClientName(diaryData.clientName || '');
            setContractorDate(diaryData.contractorDate ? new Date(diaryData.contractorDate) : undefined);
            setClientDate(diaryData.clientDate ? new Date(diaryData.clientDate) : undefined);
        } else if (!diaryId) {
            form.reset(defaultValues);
        }
    }, [diaryId, diaryData, form]);
    
    const newDiariesQuery = useMemoFirebase(() => query(collection(firestore, 'daily_diaries'), where('id', '>=', 'DD-000'), where('id', '<=', 'DD-9999')), [firestore]);
    const { data: newDiaries } = useCollection<{id: string}>(newDiariesQuery);

    useEffect(() => {
        if (diaryId) {
            setUniqueId(diaryId);
            setIsIdLoading(false);
        } else if (newDiaries !== undefined) {
            let nextNumber = 1;
            if (newDiaries && newDiaries.length > 0) {
                const validNumbers = newDiaries
                    .map(d => parseInt(d.id.replace('DD-', ''), 10))
                    .filter(n => !isNaN(n));
                if (validNumbers.length > 0) {
                    nextNumber = Math.max(...validNumbers) + 1;
                }
            }
            setUniqueId(`DD-${String(nextNumber).padStart(3, '0')}`);
            setIsIdLoading(false);
        }
    }, [diaryId, newDiaries]);

    const handleApprove = async () => {
        if (!userData?.signatureUrl) {
            toast({ variant: "destructive", title: "Signature Required", description: "Upload signature in profile first." });
            return;
        }
        setClientSignature(userData.signatureUrl);
        if (!clientName) setClientName(userData.name || '');
        setClientDate(new Date());
        form.handleSubmit((data) => handleSave(data, true))();
    };

    const handleSave = async (data: DailyDiary, isApprovalAction = false) => {
        if (!firestore || !uniqueId || !user) return;
        setIsSaving(true);
        try {
            const finalIsFinalised = isApprovalAction ? true : (diaryData?.isFinalised || false);
            const finalDiaryData: Partial<DailyDiary> = { 
                ...data,
                id: uniqueId,
                version: 'v2', // Mark as v2 for DB backwards compatibility
                userId: diaryData?.userId || user.uid,
                date: data.date ? format(new Date(data.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                createdAt: diaryData?.createdAt || serverTimestamp(),
                contractorSignature, contractorName, 
                contractorDate: contractorDate ? format(contractorDate, 'yyyy-MM-dd') : '',
                clientSignature, clientName,
                clientDate: clientDate ? format(clientDate, 'yyyy-MM-dd') : '',
                isSignedOff: finalIsFinalised ? true : (diaryData?.isSignedOff || !!contractorSignature),
                isFinalised: finalIsFinalised,
                equipmentNames: Array.from(new Set((data.works || []).map(w => w.area).filter(Boolean))),
            };

            await setDoc(doc(firestore, 'daily_diaries', uniqueId), finalDiaryData, { merge: true });
            toast({ title: isApprovalAction ? 'Approved' : 'Saved', description: `Diary ${uniqueId} saved.` });
            router.push(`/reports/diary-tracker`);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleScanPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        toast({ title: 'Scanning Document...', description: 'Analyzing the daily diary...' });

        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const dataUri = event.target?.result as string;
                    const extracted = await extractDailyDiaryData({ documentDataUri: dataUri });

                    if (extracted.error === 'DOCUMENT_UNCLEAR') {
                        toast({ variant: 'destructive', title: 'Scan Failed', description: 'The document is too blurry or illegible.' });
                        return;
                    }

                    // Reset form with extracted data merged with defaults
                    form.reset({
                        ...defaultValues,
                        ...form.getValues(), // preserve existing values not overwritten
                        ...extracted,
                        date: extracted.date ? new Date(extracted.date) : new Date(),
                    });

                    toast({ title: 'Scan Complete', description: 'Form populated with extracted data. Please review.' });
                } catch (err: any) {
                    toast({ variant: 'destructive', title: 'Scan Failed', description: err.message });
                } finally {
                    setIsScanning(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Error reading file', description: err.message });
            setIsScanning(false);
        }
    };
    
    if (isUserLoading || diaryLoading || userDataLoading || usersLoading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    // Equipment options for Section C
    const equipmentOptions = Array.from(new Set(
        equipmentList
            ?.filter(eq => !watchedArea || eq.plant === watchedArea)
            ?.map(eq => {
                const prefix = eq.mcc || eq.location || eq.division || '';
                return prefix ? `${prefix} - ${eq.name}` : eq.name;
            }) || []
    )).map(name => ({ value: name, label: name }));

    // Helper for table input styling
    const tableInputStyle = "border-0 shadow-none focus-visible:ring-0 rounded-none h-6 px-1 text-xs bg-transparent w-full font-medium text-slate-800";

    return (
        <div className="max-w-[1000px] mx-auto p-2 sm:p-4 bg-slate-50 min-h-screen font-sans">
            <style>{`
                @media print { 
                    @page { size: portrait; margin: 5mm; } 
                    body { background-color: white !important; }
                    .print-hidden { display: none !important; }
                    input, textarea { border: none !important; background: transparent !important; resize: none !important; }
                    .pdf-border { border-color: black !important; border-width: 1px !important; }
                    .pdf-text { color: black !important; }
                }
            `}</style>

            <div className="flex justify-end mb-4 gap-2 print-hidden">
                <input 
                    type="file"
                    id="scan-pdf"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={handleScanPdf}
                />
                <Button variant="outline" className="border-blue-200 hover:bg-blue-50 text-blue-700 bg-white shadow-sm" onClick={() => document.getElementById('scan-pdf')?.click()} disabled={isScanning}>
                    {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-700" /> : <FileCheck className="mr-2 h-4 w-4 text-blue-500" />}
                    Scan PDF
                </Button>
                {!diaryData?.isFinalised && (isManager || isAdmin) && !isCreator ? (
                    <Button onClick={handleApprove} disabled={isSaving || !diaryData?.isSignedOff} className="bg-green-600 hover:bg-green-700 text-white">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
                        Approve Diary
                    </Button>
                ) : (
                    <Button onClick={form.handleSubmit((data) => handleSave(data, false))} disabled={!uniqueId || isIdLoading || isSaving || diaryData?.isFinalised}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Progress
                    </Button>
                )}
                <Button variant="outline" onClick={(e) => { e.preventDefault(); window.print(); }}>
                    <Printer className="mr-2 h-4 w-4" /> Print PDF
                </Button>
            </div>

            <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => handleSave(data, false))}>
                <fieldset disabled={diaryData?.isFinalised} className="border-2 border-slate-900 bg-white pdf-border text-xs md:text-sm shadow-xl print:shadow-none relative z-0">
                    
                    {/* Header Top Row */}
                    <div className="grid grid-cols-12 border-b-2 border-slate-900 pdf-border items-stretch">
                        <div className="col-span-5 border-r-2 border-slate-900 pdf-border flex flex-col justify-center px-4 py-2 bg-slate-200">
                            <Image src="/Altek-Logo.jpeg" width={180} height={40} alt="Altek Logo" className="object-contain h-8 w-auto object-left mb-1" />
                            <div className="flex justify-between text-[10px] font-bold text-slate-600">
                                <span>Tel: 010 500 4654</span>
                                <span>Email: info@altekgreen.com</span>
                            </div>
                        </div>
                        <div className="col-span-4 border-r-2 border-slate-900 pdf-border flex items-center justify-center bg-white">
                            <h2 className="text-2xl font-black text-slate-800 tracking-wider">DAILY DIARY</h2>
                        </div>
                        <div className="col-span-3 flex flex-col items-center justify-center bg-slate-200 p-2">
                            <Input {...form.register('diaryReference')} placeholder="Diary Ref No." className="text-center font-bold h-full bg-white text-lg w-full" />
                            <div className="text-[10px] text-muted-foreground mt-1">ID: {isIdLoading ? '...' : uniqueId}</div>
                        </div>
                    </div>



                    {/* Header Inputs Table */}
                    <div className="flex flex-col border-b-2 border-slate-900 pdf-border">
                        <div className="grid grid-cols-12 border-b border-slate-900">
                            <div className="col-span-4 bg-slate-200 font-bold flex items-center justify-end px-2 border-r border-slate-900 text-xs">CONTRACT TITLE</div>
                            <div className="col-span-8 bg-white"><Input {...form.register('contractTitle')} className={tableInputStyle} /></div>
                        </div>
                        <div className="grid grid-cols-12 border-b border-slate-900">
                            <div className="col-span-4 bg-slate-200 font-bold flex items-center justify-end px-2 border-r border-slate-900 text-xs">CONTRACT NUMBER</div>
                            <div className="col-span-8 bg-white"><Input {...form.register('contractNumber')} className={tableInputStyle} /></div>
                        </div>
                        <div className="grid grid-cols-12 border-b border-slate-900 items-stretch">
                            <div className="col-span-4 bg-slate-200 font-bold flex items-center justify-end px-2 border-r border-slate-900 text-xs py-1">AREA</div>
                            <div className="col-span-8 bg-white flex items-center px-4 gap-8">
                                <Controller control={form.control} name="area" render={({ field }) => (
                                    <>
                                        <div className="flex items-center gap-2 font-bold text-xs cursor-pointer" onClick={() => field.onChange('Mining')}>
                                            <div className="w-6 h-4 border border-black flex items-center justify-center">{field.value === 'Mining' && '✓'}</div>
                                            MINING
                                        </div>
                                        <div className="flex items-center gap-2 font-bold text-xs cursor-pointer" onClick={() => field.onChange('Smelter')}>
                                            <div className="w-6 h-4 border border-black flex items-center justify-center">{field.value === 'Smelter' && '✓'}</div>
                                            SMELTER
                                        </div>
                                    </>
                                )} />
                            </div>
                        </div>
                        <div className="grid grid-cols-12">
                            <div className="col-span-2 bg-slate-200 font-bold flex items-center justify-end px-2 border-r border-slate-900 text-[10px]">DATE</div>
                            <div className="col-span-2 bg-white border-r border-slate-900 flex items-center justify-center">
                                <FormField control={form.control} name="date" render={({ field }) => (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" className="h-6 text-xs w-full px-1 shadow-none rounded-none">{field.value ? format(new Date(field.value), "yyyy/MM/dd") : ''}</Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} autoFocus /></PopoverContent>
                                    </Popover>
                                )} />
                            </div>
                            <div className="col-span-2 bg-slate-200 font-bold flex items-center justify-end px-2 border-r border-slate-900 text-[10px]">SHIFT START</div>
                            <div className="col-span-2 bg-white border-r border-slate-900"><Input type="time" {...form.register('shiftStart')} className={tableInputStyle} /></div>
                            <div className="col-span-1 bg-slate-200 font-bold flex items-center justify-end px-1 border-r border-slate-900 text-[10px]">SHIFT END</div>
                            <div className="col-span-1 bg-white border-r border-slate-900"><Input type="time" {...form.register('shiftEnd')} className={tableInputStyle} /></div>
                            <div className="col-span-1 bg-slate-200 font-bold flex items-center justify-center border-r border-slate-900 text-[10px]">HRS</div>
                            <div className="col-span-1 bg-white text-center flex items-center justify-center text-xs font-bold">{form.watch('hrs') || ''}</div>
                        </div>
                    </div>

                    {/* SECTION A */}
                    <div className="bg-slate-300 border-b border-slate-900 font-bold text-center text-xs py-1 pdf-border">SECTION A: HSE</div>
                    <div className="bg-slate-200 border-b border-slate-900 text-center text-[10px] py-1 pdf-border">Incidents/Accidents/Injuries</div>
                    <div className="bg-white border-b-2 border-slate-900 pdf-border"><Input {...form.register('incidents')} className={cn(tableInputStyle, "h-8")} /></div>
                    
                    <div className="bg-slate-200 border-b border-slate-900 text-center text-[10px] py-1 pdf-border">Toolbox Talk</div>
                    <div className="bg-white border-b-2 border-slate-900 pdf-border"><Input {...form.register('toolboxTalk')} className={cn(tableInputStyle, "h-8")} /></div>

                    {/* SECTION B */}
                    <div className="bg-slate-300 border-b border-slate-900 font-bold text-center text-xs py-1 pdf-border relative">
                        SECTION B: MANPOWER AND PLANT
                        {canEdit && <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-0 h-6 w-6 print-hidden" onClick={() => appendManpower({ designation: '', forecast: 0, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' })}><Plus className="h-4 w-4"/></Button>}
                    </div>
                    
                    <table className="w-full text-center border-collapse border-b-2 border-slate-900 pdf-border bg-white text-[10px]">
                        <thead>
                            <tr className="bg-slate-200 border-b border-slate-900">
                                <th className="border-r border-slate-900 font-semibold p-1 w-1/4">Name</th>
                                <th className="border-r border-slate-900 font-semibold p-1 w-12">Forecast</th>
                                <th className="border-r border-slate-900 font-semibold p-1 w-12">Actual</th>
                                <th className="border-r border-slate-900 font-semibold p-1 w-12 text-[8px]">Normal Hrs</th>
                                <th className="border-r border-slate-900 font-semibold p-1 w-12 text-[8px]">1.5 Overtime</th>
                                <th className="border-r border-slate-900 font-semibold p-1 w-12 text-[8px]">2.0 Overtime</th>
                                <th className="border-r border-slate-900 font-semibold p-1 w-14 text-[8px]">Total Man Hrs</th>
                                <th className="font-semibold p-1">Comments</th>
                                <th className="w-6 print-hidden bg-white"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {manpowerFields.map((field, index) => {
                                const { onChange: actualOnChange, ...actualRest } = form.register(`manpower.${index}.actual`, { valueAsNumber: true });
                                const { onChange: normalOnChange, ...normalRest } = form.register(`manpower.${index}.normalHrs`, { valueAsNumber: true });
                                const { onChange: ot15OnChange, ...ot15Rest } = form.register(`manpower.${index}.overtime1_5`, { valueAsNumber: true });
                                const { onChange: ot20OnChange, ...ot20Rest } = form.register(`manpower.${index}.overtime2_0`, { valueAsNumber: true });

                                const calculateManpowerHours = (e: React.ChangeEvent<HTMLInputElement>, originalOnChange: (e: any) => void) => {
                                    originalOnChange(e);
                                    const actual = parseFloat(String(form.getValues(`manpower.${index}.actual`))) || 0;
                                    const normal = parseFloat(String(form.getValues(`manpower.${index}.normalHrs`))) || 0;
                                    const ot15 = parseFloat(String(form.getValues(`manpower.${index}.overtime1_5`))) || 0;
                                    const ot20 = parseFloat(String(form.getValues(`manpower.${index}.overtime2_0`))) || 0;
                                    const total = actual * (normal + ot15 + ot20);
                                    form.setValue(`manpower.${index}.totalManHrs`, parseFloat(total.toFixed(2)));
                                };

                                return (
                                <tr key={field.id} className="border-b border-slate-900 group">
                                    <td className="border-r border-slate-900 relative">
                                        <Controller control={form.control} name={`manpower.${index}.designation`} render={({ field: comboField }) => (
                                            <>
                                                <div className="print-hidden">
                                                    <Combobox options={nameOptions} value={comboField.value || ''} onChange={comboField.onChange} creatable={true} placeholder="" className="h-6 border-0 shadow-none text-xs rounded-none" />
                                                </div>
                                                <div className="hidden print:block text-xs text-left px-2">{comboField.value}</div>
                                            </>
                                        )} />
                                    </td>
                                    <td className="border-r border-slate-900"><Input type="number" {...form.register(`manpower.${index}.forecast`, { valueAsNumber: true })} className={cn(tableInputStyle, "text-center")} /></td>
                                    <td className="border-r border-slate-900"><Input type="number" {...actualRest} onChange={(e) => calculateManpowerHours(e, actualOnChange)} className={cn(tableInputStyle, "text-center")} /></td>
                                    <td className="border-r border-slate-900"><Input type="number" step="0.5" {...normalRest} onChange={(e) => calculateManpowerHours(e, normalOnChange)} className={cn(tableInputStyle, "text-center")} /></td>
                                    <td className="border-r border-slate-900"><Input type="number" step="0.5" {...ot15Rest} onChange={(e) => calculateManpowerHours(e, ot15OnChange)} className={cn(tableInputStyle, "text-center")} /></td>
                                    <td className="border-r border-slate-900"><Input type="number" step="0.5" {...ot20Rest} onChange={(e) => calculateManpowerHours(e, ot20OnChange)} className={cn(tableInputStyle, "text-center")} /></td>
                                    <td className="border-r border-slate-900 bg-slate-50 font-bold">{form.watch(`manpower.${index}.totalManHrs`) || ''}</td>
                                    <td><Input {...form.register(`manpower.${index}.comments`)} className={tableInputStyle} /></td>
                                    <td className="print-hidden bg-white"><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeManpower(index)}><X className="h-3 w-3 text-red-500"/></Button></td>
                                </tr>
                            )})}
                            <tr className="bg-slate-200 border-b border-slate-900 font-bold">
                                <td colSpan={2} className="text-right p-1 pr-2 border-r border-slate-900">Total Workforce on site</td>
                                <td className="border-r border-slate-900 bg-white">
                                    {watchedManpower?.reduce((acc, m) => acc + (parseFloat(String(m?.actual||0))||0), 0)}
                                </td>
                                <td colSpan={3} className="text-right p-1 pr-2 border-r border-slate-900">Total Man Hrs</td>
                                <td className="border-r border-slate-900 bg-white">
                                    {watchedManpower?.reduce((acc, m) => acc + (parseFloat(String(m?.totalManHrs||0))||0), 0)}
                                </td>
                                <td></td><td className="print-hidden bg-white"></td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="relative">
                        {canEdit && <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-0 h-6 w-6 print-hidden z-10" onClick={() => appendPlant({ description: '', qty: 1, inspectionDone: 'yes', comments: '' })}><Plus className="h-4 w-4"/></Button>}
                        <table className="w-full text-center border-collapse border-b-2 border-slate-900 pdf-border bg-white text-[10px]">
                            <thead>
                                <tr className="bg-slate-200 border-b border-slate-900">
                                    <th className="border-r border-slate-900 font-semibold p-1 w-1/3">Plant description</th>
                                    <th className="border-r border-slate-900 font-semibold p-1 w-12">Qty</th>
                                    <th className="border-r border-slate-900 font-semibold p-1 w-32">Daily Inspection Done</th>
                                    <th className="font-semibold p-1">Comments</th>
                                    <th className="w-6 print-hidden bg-white"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {plantFields.map((field, index) => (
                                    <tr key={field.id} className="border-b border-slate-900 group">
                                        <td className="border-r border-slate-900"><Input {...form.register(`plant.${index}.description`)} className={tableInputStyle} /></td>
                                        <td className="border-r border-slate-900"><Input type="number" {...form.register(`plant.${index}.qty`, { valueAsNumber: true })} className={cn(tableInputStyle, "text-center")} /></td>
                                        <td className="border-r border-slate-900 flex justify-center items-center gap-4 py-1 h-6">
                                            <Controller control={form.control} name={`plant.${index}.inspectionDone`} render={({ field: radio }) => (
                                                <>
                                                    <span className="flex items-center gap-1 cursor-pointer font-bold text-xs" onClick={() => radio.onChange('yes')}>
                                                        <div className="w-4 h-4 border border-black flex items-center justify-center">{radio.value === 'yes' && '✓'}</div> Y
                                                    </span>
                                                    <span className="flex items-center gap-1 cursor-pointer font-bold text-xs" onClick={() => radio.onChange('no')}>
                                                        <div className="w-4 h-4 border border-black flex items-center justify-center">{radio.value === 'no' && '✓'}</div> N
                                                    </span>
                                                </>
                                            )} />
                                        </td>
                                        <td><Input {...form.register(`plant.${index}.comments`)} className={tableInputStyle} /></td>
                                        <td className="print-hidden bg-white"><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removePlant(index)}><X className="h-3 w-3 text-red-500"/></Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* SECTION C */}
                    <div className="bg-slate-300 border-b border-slate-900 font-bold text-center text-xs py-1 pdf-border relative">
                        SECTION C: DESCRIPTION OF WORKS
                        {canEdit && <Button type="button" size="sm" variant="outline" className="absolute right-1 top-0 h-6 text-[10px] print-hidden z-10" onClick={() => appendWork({ area: '', scope: '', timeStart: '', timeEnd: '', hrs: 0 })}><Plus className="h-3 w-3 mr-1"/> Add Equipment</Button>}
                    </div>
                    
                    <table className="w-full text-center border-collapse border-b-2 border-slate-900 pdf-border bg-white text-[10px]">
                        <thead>
                            <tr className="bg-slate-200 border-b border-slate-900">
                                <th className="border-r border-slate-900 font-semibold p-1 w-1/4">Area of Work</th>
                                <th className="border-r border-slate-900 font-semibold p-1">Scope of Work</th>
                                <th className="border-r border-slate-900 font-semibold p-1 w-16">Time Start</th>
                                <th className="border-r border-slate-900 font-semibold p-1 w-16">Time End</th>
                                <th className="font-semibold p-1 w-16">Hrs</th>
                                <th className="w-6 print-hidden bg-white"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {workFields.map((field, index) => {
                                const { onChange: startOnChange, ...startRest } = form.register(`works.${index}.timeStart`);
                                const { onChange: endOnChange, ...endRest } = form.register(`works.${index}.timeEnd`);

                                const calculateHours = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'start' | 'end') => {
                                    if (fieldName === 'start') startOnChange(e);
                                    else endOnChange(e);
                                    
                                    const start = form.getValues(`works.${index}.timeStart`);
                                    const end = form.getValues(`works.${index}.timeEnd`);
                                    
                                    if (start && end) {
                                        const [startHr, startMin] = start.split(':').map(Number);
                                        const [endHr, endMin] = end.split(':').map(Number);
                                        let diffHrs = (endHr - startHr) + (endMin - startMin) / 60;
                                        if (diffHrs < 0) diffHrs += 24; // Cross midnight
                                        form.setValue(`works.${index}.hrs`, parseFloat(diffHrs.toFixed(2)));
                                    }
                                };

                                return (
                                <tr key={field.id} className="border-b border-slate-900 group">
                                    <td className="border-r border-slate-900 relative p-0 m-0">
                                        <Controller control={form.control} name={`works.${index}.area`} render={({ field: selectField }) => (
                                            <>
                                                <div className="print-hidden">
                                                    <Combobox options={equipmentOptions} value={selectField.value || ''} onChange={selectField.onChange} creatable={true} placeholder="" className="h-6 border-0 shadow-none text-xs rounded-none bg-transparent" />
                                                </div>
                                                <div className="hidden print:block text-xs text-left px-2">{selectField.value}</div>
                                            </>
                                        )} />
                                    </td>
                                    <td className="border-r border-slate-900"><Input {...form.register(`works.${index}.scope`)} className={tableInputStyle} /></td>
                                    <td className="border-r border-slate-900"><Input type="time" {...startRest} onChange={(e) => calculateHours(e, 'start')} className={tableInputStyle} /></td>
                                    <td className="border-r border-slate-900"><Input type="time" {...endRest} onChange={(e) => calculateHours(e, 'end')} className={tableInputStyle} /></td>
                                    <td><Input type="number" step="0.5" {...form.register(`works.${index}.hrs`, { valueAsNumber: true })} className={cn(tableInputStyle, "text-center")} /></td>
                                    <td className="print-hidden bg-white"><Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeWork(index)}><X className="h-3 w-3 text-red-500"/></Button></td>
                                </tr>
                            )})}
                        </tbody>
                    </table>

                    {/* SECTION D */}
                    <div className="bg-slate-300 border-b border-slate-900 font-bold text-center text-xs py-1 pdf-border">SECTION D: DELAYS</div>
                    <div className="flex flex-col border-b-2 border-slate-900 pdf-border bg-white">
                        {[0,1,2,3,4].map((i) => (
                            <div key={`delay-${i}`} className="flex border-b border-slate-900 last:border-b-0 items-center">
                                <div className="w-8 border-r border-slate-900 text-center text-xs font-bold bg-slate-200 py-[2px]">{i+1}</div>
                                <Input {...form.register(`delays.${i}` as any)} className={tableInputStyle} />
                            </div>
                        ))}
                    </div>

                    {/* SECTION E */}
                    <div className="bg-slate-300 border-b border-slate-900 font-bold text-center text-xs py-1 pdf-border">SECTION E: COMMENTS</div>
                    <div className="flex flex-col border-b-2 border-slate-900 pdf-border bg-white">
                        {[0,1,2,3,4].map((i) => (
                            <div key={`comment-${i}`} className="flex border-b border-slate-900 last:border-b-0 items-center">
                                <div className="w-8 border-r border-slate-900 text-center text-xs font-bold bg-slate-200 py-[2px]">{i+1}</div>
                                <Input {...form.register(`comments.${i}` as any)} className={tableInputStyle} />
                            </div>
                        ))}
                    </div>

                    {/* FOOTER SIGNATURES */}
                    <div className="grid grid-cols-2 text-[10px] text-center uppercase">
                        <div className="border-r-2 border-slate-900 pdf-border bg-slate-200 font-bold border-b-2 py-1">CONTRACTOR</div>
                        <div className="bg-slate-200 font-bold border-b-2 border-slate-900 pdf-border py-1">CLIENT</div>
                        
                        {/* Contractor Sign */}
                        <div className="border-r-2 border-slate-900 pdf-border grid grid-cols-3 bg-white">
                            <div className="border-r border-slate-900 flex flex-col items-center w-full relative">
                                <span className="text-[8px] font-bold py-1">NAME</span>
                                <div className="w-full print-hidden">
                                    <Combobox options={nameOptions} value={contractorName} onChange={setContractorName} creatable={true} placeholder="" disabled={!!contractorSignature || !canEdit} className="border-0 text-center h-8 font-bold text-xs shadow-none w-full px-1 bg-transparent" />
                                </div>
                                <div className="hidden print:block text-xs font-bold text-center h-8 leading-8 w-full">{contractorName}</div>
                            </div>
                            <div className="border-r border-slate-900 flex flex-col items-center relative h-14">
                                <span className="text-[8px] font-bold py-1 z-10 absolute top-0 w-full text-center pointer-events-none">SIGNATURE</span>
                                {contractorSignature ? (
                                    <div className="w-full h-full relative flex justify-center items-center pt-2">
                                        <img src={contractorSignature} alt="Sig" className="max-h-8 w-auto mix-blend-multiply" />
                                        {canEdit && <Button type="button" variant="ghost" size="icon" onClick={() => setContractorSignature(null)} className="absolute top-0 right-0 h-6 w-6 print-hidden z-20 hover:bg-red-100"><X className="h-4 w-4 text-red-500"/></Button>}
                                    </div>
                                ) : (
                                    <div className="mt-4 scale-[0.6] origin-top relative z-10"><SignaturePad onSave={setContractorSignature} width={200} height={60} /></div>
                                )}
                            </div>
                            <div className="flex flex-col items-center w-full relative">
                                <span className="text-[8px] font-bold py-1">DATE</span>
                                <div className="w-full print-hidden">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" className="h-8 text-xs font-bold w-full rounded-none" disabled={!!contractorSignature || !canEdit}>{contractorDate ? format(contractorDate, "yyyy/MM/dd") : ''}</Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={contractorDate} onSelect={setContractorDate} autoFocus /></PopoverContent>
                                    </Popover>
                                </div>
                                <div className="hidden print:block text-xs font-bold text-center h-8 leading-8 w-full">{contractorDate ? format(contractorDate, "yyyy/MM/dd") : ''}</div>
                            </div>
                        </div>

                        {/* Client Sign */}
                        <div className="grid grid-cols-3 bg-white">
                            <div className="border-r border-slate-900 flex flex-col items-center w-full relative">
                                <span className="text-[8px] font-bold py-1">NAME</span>
                                <div className="w-full print-hidden">
                                    <Combobox options={nameOptions} value={clientName} onChange={setClientName} creatable={true} placeholder="" disabled={!!clientSignature || !canEdit} className="border-0 text-center h-8 font-bold text-xs shadow-none w-full px-1 bg-transparent" />
                                </div>
                                <div className="hidden print:block text-xs font-bold text-center h-8 leading-8 w-full">{clientName}</div>
                            </div>
                            <div className="border-r border-slate-900 flex flex-col items-center relative h-14">
                                <span className="text-[8px] font-bold py-1 z-10 absolute top-0 w-full text-center pointer-events-none">SIGNATURE</span>
                                {clientSignature ? (
                                    <div className="w-full h-full relative flex justify-center items-center pt-2">
                                        <img src={clientSignature} alt="Client Sig" className="max-h-8 w-auto mix-blend-multiply" />
                                        {canEdit && <Button type="button" variant="ghost" size="icon" onClick={() => setClientSignature(null)} className="absolute top-0 right-0 h-6 w-6 print-hidden z-20 hover:bg-red-100"><X className="h-4 w-4 text-red-500"/></Button>}
                                    </div>
                                ) : (
                                    <div className="mt-4 scale-[0.6] origin-top relative z-10"><SignaturePad onSave={setClientSignature} width={200} height={60} /></div>
                                )}
                            </div>
                            <div className="flex flex-col items-center w-full relative">
                                <span className="text-[8px] font-bold py-1">DATE</span>
                                <div className="w-full print-hidden">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" className="h-8 text-xs font-bold w-full rounded-none" disabled={!!clientSignature || !canEdit}>{clientDate ? format(clientDate, "yyyy/MM/dd") : ''}</Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={clientDate} onSelect={setClientDate} autoFocus /></PopoverContent>
                                    </Popover>
                                </div>
                                <div className="hidden print:block text-xs font-bold text-center h-8 leading-8 w-full">{clientDate ? format(clientDate, "yyyy/MM/dd") : ''}</div>
                            </div>
                        </div>
                    </div>
                </fieldset>
            </form>
            </Form>
        </div>
    );
}
