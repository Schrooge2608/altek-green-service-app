
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { VoiceTextarea } from '@/components/ui/voice-textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { CalendarIcon, Printer, Save, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DailyDiary, User as AppUser, User, WorkEntry, PlantEntry, ManpowerEntry } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploader } from '@/components/image-uploader';


export default function NewDailyDiaryPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { firestore, firebaseApp, auth } = useFirebase();
    const { user, isUserLoading } = useUser();

    const diaryId = searchParams.get('id');
    const equipmentNameFromQuery = searchParams.get('equipmentName');

    const [uniqueId, setUniqueId] = useState('');
    const [isIdLoading, setIsIdLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
    const [afterFiles, setAfterFiles] = useState<File[]>([]);
    const [contractorSignature, setContractorSignature] = useState<string | null>(null);
    const [clientSignature, setClientSignature] = useState<string | null>(null);
    const [contractorName, setContractorName] = useState('');
    const [clientName, setClientName] = useState('');
    const [contractorDate, setContractorDate] = useState<Date>();
    const [clientDate, setClientDate] = useState<Date>();

    const { data: diaryData, isLoading: diaryLoading } = useDoc<DailyDiary>(
        useMemoFirebase(() => diaryId ? doc(firestore, 'daily_diaries', diaryId) : null, [firestore, diaryId])
    );
    
    const { data: users, isLoading: usersLoading } = useCollection<User>(
        useMemoFirebase(() => collection(firestore, 'users'), [firestore])
    );

    const { data: userRole } = useDoc<AppUser>(
        useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
    );
    const isClientManager = userRole?.role === 'Client Manager';

    const defaultValues = useMemo(() => {
        const works = Array(5).fill(null).map(() => ({ area: '', scope: '', timeStart: '', timeEnd: '', hrs: undefined }));
        if (equipmentNameFromQuery && !diaryId) {
            works[0].scope = `Unscheduled work on: ${equipmentNameFromQuery}`;
        }
        return {
            contractTitle: 'VSD MAINTENANCE',
            contractNumber: 'CW 22038313',
            area: 'Mining' as 'Mining' | 'Smelter',
            date: new Date(),
            shiftStart: '',
            shiftEnd: '',
            hrs: undefined,
            incidents: '',
            toolboxTalk: '',
            manpower: [
                { designation: 'Site Supervisor', forecast: 1, actual: 1, normalHrs: 9, overtime1_5: 0, overtime2_0: 0, totalManHrs: 9, comments: '' },
                { designation: 'Electrician', forecast: 1, actual: 1, normalHrs: 9, overtime1_5: 0, overtime2_0: 0, totalManHrs: 9, comments: '' },
                { designation: 'Assistant', forecast: 2, actual: 2, normalHrs: 9, overtime1_5: 0, overtime2_0: 0, totalManHrs: 18, comments: '' },
                { designation: 'Safety Officer', forecast: 1, actual: 1, normalHrs: 9, overtime1_5: 0, overtime2_0: 0, totalManHrs: 9, comments: '' },
            ] as ManpowerEntry[],
            plant: [
                { description: 'LDV - Single Cab', qty: 1, inspectionDone: 'yes', comments: '' },
                { description: 'LDV - Double Cab', qty: 1, inspectionDone: 'yes', comments: '' },
            ] as PlantEntry[],
            works: works,
            delays: Array(5).fill(''),
            comments: Array(5).fill('')
        }
    }, [equipmentNameFromQuery, diaryId]);

    const form = useForm<DailyDiary>({
        defaultValues,
    });
    
    const { fields: manpowerFields, append: appendManpower, remove: removeManpower } = useFieldArray({ control: form.control, name: "manpower" });
    const { fields: plantFields, append: appendPlant, remove: removePlant } = useFieldArray({ control: form.control, name: "plant" });
    const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({ control: form.control, name: "works" });


    useEffect(() => {
        if (diaryData) {
            form.reset({
                ...defaultValues,
                ...diaryData,
                date: diaryData.date ? new Date(diaryData.date) : new Date(),
            });
            setContractorSignature(diaryData.contractorSignature || null);
            setClientSignature(diaryData.clientSignature || null);
            setContractorName(diaryData.contractorName || '');
            setClientName(diaryData.clientName || '');
            setContractorDate(diaryData.contractorDate ? new Date(diaryData.contractorDate) : undefined);
            setClientDate(diaryData.clientDate ? new Date(diaryData.clientDate) : undefined);
        }
    }, [diaryData, form, defaultValues]);
    
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

    const uploadImages = async (files: File[], folder: 'before' | 'after'): Promise<string[]> => {
        if (!firebaseApp || files.length === 0) return [];
        
        const storage = getStorage(firebaseApp);
        
        const uploadPromises = files.map(file => {
            const storagePath = `daily_diaries/${uniqueId}/${folder}/${file.name}`;
            const storageRef = ref(storage, storagePath);
            return uploadBytes(storageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
        });
    
        try {
            const downloadedUrls = await Promise.all(uploadPromises);
            return downloadedUrls;
        } catch (error) {
            console.error("Image upload failed:", error);
            toast({ variant: "destructive", title: "Upload Failed", description: "Could not upload one or more images." });
            throw error;
        }
    };

    const handleSave = async (data: DailyDiary) => {
        if (!firestore || !uniqueId || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not logged in or database not available.' });
            return;
        }

        setIsSaving(true);
        try {
            const newBeforeImageUrls = await uploadImages(beforeFiles, 'before');
            const newAfterImageUrls = await uploadImages(afterFiles, 'after');

            const diaryDocRef = doc(firestore, 'daily_diaries', uniqueId);

            const finalDiaryData: Partial<DailyDiary> = { 
                ...data,
                id: uniqueId,
                userId: user.uid,
                isSignedOff: diaryData?.isSignedOff || false,
                createdAt: diaryData?.createdAt || serverTimestamp(),
                date: data.date ? format(new Date(data.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                beforeWorkImages: [...(diaryData?.beforeWorkImages || []), ...newBeforeImageUrls],
                afterWorkImages: [...(diaryData?.afterWorkImages || []), ...newAfterImageUrls],
                contractorSignature,
                clientSignature,
                contractorName,
                clientName,
                contractorDate: contractorDate ? format(contractorDate, 'yyyy-MM-dd') : '',
                clientDate: clientDate ? format(clientDate, 'yyyy-MM-dd') : '',
            };

            await setDoc(diaryDocRef, finalDiaryData, { merge: true });
            
            toast({
                title: 'Diary Saved',
                description: `Document ${uniqueId} has been saved successfully.`,
            });
            
            router.push(`/reports/diary-tracker`);
        } catch (error: any) {
            console.error("Failed to save diary:", error);
            if (!error.message || !error.message.includes("upload")) {
                 toast({
                    variant: 'destructive',
                    title: 'Save Failed',
                    description: error.message || 'An unexpected error occurred while saving the diary.',
                });
            }
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isUserLoading || diaryLoading) {
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
                 <Button onClick={form.handleSubmit(handleSave)} disabled={!uniqueId || isIdLoading || isClientManager || isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSaving ? 'Saving...' : 'Save Diary'}
                </Button>
                <Button onClick={() => window.print()} variant="outline">
                    <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
            </div>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)}>
                <Card className="p-8 shadow-lg" id="diary-form">
                    <header className="flex items-start justify-between mb-4 border-b pb-4">
                        <AltekLogo className="h-10" />
                        <div className="text-right">
                            <h1 className="text-2xl font-bold tracking-tight text-primary">{diaryId ? 'Edit Daily Diary' : 'DAILY DIARY'}</h1>
                            <p className="text-sm text-muted-foreground font-mono">ID: {isIdLoading ? 'Generating...' : uniqueId}</p>
                        </div>
                    </header>

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
                                      <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
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
                        </CardContent>
                    </Card>

                    <Card className="mb-4">
                        <CardHeader className="bg-muted p-2 rounded-t-lg flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">SECTION B: MANPOWER AND PLANT</CardTitle>
                            <Button size="sm" type="button" onClick={() => appendManpower({ designation: '', forecast: 1, actual: 1, normalHrs: 9, overtime1_5: 0, overtime2_0: 0, totalManHrs: 9, comments: '' })}><Plus className="mr-2 h-4 w-4"/>Add Manpower</Button>
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
                                        <TableHead />
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
                                            <TableCell><Button variant="ghost" size="icon" type="button" onClick={() => removeManpower(index)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                             <Button size="sm" type="button" onClick={() => appendPlant({ description: '', qty: 1, inspectionDone: 'no', comments: '' })}><Plus className="mr-2 h-4 w-4"/>Add Plant</Button>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Plant description</TableHead>
                                        <TableHead>Qty</TableHead>
                                        <TableHead>Daily Inspection Done</TableHead>
                                        <TableHead>Comments</TableHead>
                                        <TableHead />
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
                                            <TableCell><Button variant="ghost" size="icon" type="button" onClick={() => removePlant(index)}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="mb-4">
                        <CardHeader className="bg-muted p-2 rounded-t-lg flex flex-row items-center justify-between">
                            <CardTitle className="text-sm">SECTION C: DESCRIPTION OF WORKS</CardTitle>
                             <Button size="sm" type="button" onClick={() => appendWork({ area: '', scope: '', timeStart: '', timeEnd: '', hrs: 0 })}><Plus className="mr-2 h-4 w-4"/>Add Work</Button>
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
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workFields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell><Input {...form.register(`works.${index}.area`)}/></TableCell>
                                            <TableCell><Textarea {...form.register(`works.${index}.scope`)}/></TableCell>
                                            <TableCell><Input type="time" {...form.register(`works.${index}.timeStart`)}/></TableCell>
                                            <TableCell><Input type="time" {...form.register(`works.${index}.timeEnd`)}/></TableCell>
                                            <TableCell><Input type="number" className="w-[70px]" {...form.register(`works.${index}.hrs`, { valueAsNumber: true })}/></TableCell>
                                            <TableCell><Button variant="ghost" size="icon" type="button" onClick={() => removeWork(index)}><Trash2 className="h-4 w-4"/></Button></TableCell>
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
                                <h4 className="font-semibold">Before Work</h4>
                                <ImageUploader onImagesChange={setBeforeFiles} title="Before Work" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-semibold">After Work</h4>
                                <ImageUploader onImagesChange={setAfterFiles} title="After Work" />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-8 mt-8">
                        <Card>
                             <CardHeader className="p-4">
                                <CardTitle className="text-base text-center">CONTRACTOR</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                <div className="space-y-1">
                                    <Label>Name</Label>
                                    <Input value={contractorName} onChange={(e) => setContractorName(e.target.value)} />
                                </div>
                                 <div className="space-y-1">
                                    <Label>Signature</Label>
                                    <SignaturePad value={contractorSignature} onSign={setContractorSignature} onClear={() => setContractorSignature(null)} />
                                </div>
                                 <div className="space-y-1">
                                    <Label>Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !contractorDate && "text-muted-foreground")}>
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
                                <CardTitle className="text-base text-center">CLIENT</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                 <div className="space-y-1">
                                    <Label>Name</Label>
                                    <Input value={clientName} onChange={(e) => setClientName(e.target.value)}/>
                                </div>
                                 <div className="space-y-1">
                                    <Label>Signature</Label>
                                    <SignaturePad value={clientSignature} onSign={setClientSignature} onClear={() => setClientSignature(null)} />
                                </div>
                                 <div className="space-y-1">
                                    <Label>Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !clientDate && "text-muted-foreground")}>
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
            </form>
            </Form>
        </div>
    );
}

    