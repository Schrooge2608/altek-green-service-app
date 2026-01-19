
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useUser, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useStorage } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, PlusCircle, Save, Trash2 } from 'lucide-react';
import { AltekLogo } from '@/components/altek-logo';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { VoiceTextarea } from '@/components/ui/voice-textarea';
import { SignaturePad } from '@/components/ui/signature-pad';
import { ImageUploader } from '@/components/image-uploader';
import type { DailyDiary, User, ManpowerEntry, PlantEntry, WorkEntry } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const manpowerSchema = z.object({
  designation: z.string().optional(),
  forecast: z.coerce.number().optional(),
  actual: z.coerce.number().optional(),
  normalHrs: z.coerce.number().optional(),
  overtime1_5: z.coerce.number().optional(),
  overtime2_0: z.coerce.number().optional(),
  totalManHrs: z.coerce.number().optional(),
  comments: z.string().optional(),
});

const plantSchema = z.object({
  description: z.string().optional(),
  qty: z.coerce.number().optional(),
  inspectionDone: z.enum(['yes', 'no']).optional(),
  comments: z.string().optional(),
});

const workSchema = z.object({
  area: z.string().optional(),
  scope: z.string().optional(),
  timeStart: z.string().optional(),
  timeEnd: z.string().optional(),
  hrs: z.coerce.number().optional(),
});

const formSchema = z.object({
  contractTitle: z.string().min(1, 'Contract title is required.'),
  contractNumber: z.string().min(1, 'Contract number is required.'),
  area: z.enum(['Mining', 'Smelter']),
  date: z.string().min(1, 'Date is required.'),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  hrs: z.coerce.number().optional(),
  incidents: z.string().optional(),
  toolboxTalk: z.string().optional(),
  manpower: z.array(manpowerSchema).optional(),
  plant: z.array(plantSchema).optional(),
  works: z.array(workSchema).optional(),
  delays: z.string().optional(),
  comments: z.string().optional(),
  contractorName: z.string().optional(),
  contractorSignature: z.string().optional(),
  contractorDate: z.string().optional(),
  clientName: z.string().optional(),
  clientSignature: z.string().optional(),
  clientDate: z.string().optional(),
});

export default function NewDailyDiaryPage() {
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore, auth } = useFirebase();
    const { user } = useUser();
    const storage = useStorage();

    const diaryId = searchParams.get('id');

    const [isSaving, setIsSaving] = useState(false);
    const [beforeWorkFiles, setBeforeWorkFiles] = useState<File[]>([]);
    const [afterWorkFiles, setAfterWorkFiles] = useState<File[]>([]);

    const diaryRef = useMemoFirebase(() => diaryId ? doc(firestore, 'daily_diaries', diaryId) : null, [firestore, diaryId]);
    const { data: diaryData, isLoading: diaryLoading } = useDoc<DailyDiary>(diaryRef);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            contractTitle: '',
            contractNumber: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            manpower: [{ designation: 'Supervisor' }, { designation: 'Technician' }],
            plant: [{}],
            works: [{}],
        },
    });

    const { fields: manpowerFields, append: appendManpower, remove: removeManpower } = useFieldArray({ control: form.control, name: "manpower" });
    const { fields: plantFields, append: appendPlant, remove: removePlant } = useFieldArray({ control: form.control, name: "plant" });
    const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({ control: form.control, name: "works" });

    useEffect(() => {
        if (diaryData) {
            const delaysString = Array.isArray(diaryData.delays) ? diaryData.delays.join('\n') : '';
            const commentsString = Array.isArray(diaryData.comments) ? diaryData.comments.join('\n') : '';
            form.reset({
                ...diaryData,
                delays: delaysString,
                comments: commentsString,
            });
        } else if (user) {
            form.setValue('contractorName', user.displayName || '');
        }
    }, [diaryData, form, user]);

    const uploadImages = async (files: File[], diaryDocId: string, folder: string): Promise<string[]> => {
        if (!storage) return [];
        const urls: string[] = [];
        for (const file of files) {
            const filePath = `diary_images/${diaryDocId}/${folder}/${file.name}`;
            const fileRef = ref(storage, filePath);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            urls.push(url);
        }
        return urls;
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user || !auth) {
            toast({ variant: 'destructive', title: 'Not authenticated', description: 'You must be logged in to save a diary.' });
            return;
        }

        setIsSaving(true);
        try {
            const delays = values.delays?.split('\n').filter(d => d.trim() !== '') || [];
            const comments = values.comments?.split('\n').filter(c => c.trim() !== '') || [];
            
            const currentDocId = diaryId || doc(collection(firestore, 'temp')).id;
            
            const [beforeWorkImageUrls, afterWorkImageUrls] = await Promise.all([
                uploadImages(beforeWorkFiles, currentDocId, 'before'),
                uploadImages(afterWorkFiles, currentDocId, 'after')
            ]);
            
            const existingBeforeImages = diaryData?.beforeWorkImages || [];
            const existingAfterImages = diaryData?.afterWorkImages || [];

            const dataToSave = {
                ...values,
                delays,
                comments,
                userId: user.uid,
                beforeWorkImages: [...existingBeforeImages, ...beforeWorkImageUrls],
                afterWorkImages: [...existingAfterImages, ...afterWorkImageUrls],
            };

            if (diaryId) {
                const docRef = doc(firestore, 'daily_diaries', diaryId);
                updateDocumentNonBlocking(docRef, dataToSave);
                toast({ title: 'Diary Updated', description: 'Your changes have been saved successfully.' });
            } else {
                const docToCreate = {
                    ...dataToSave,
                    id: currentDocId,
                    createdAt: serverTimestamp(),
                    isSignedOff: false,
                }
                const newDocRef = doc(firestore, 'daily_diaries', currentDocId);
                addDocumentNonBlocking(newDocRef, docToCreate);
                toast({ title: 'Diary Created', description: 'The new daily diary has been saved.' });
            }
            router.push('/reports/diary-tracker');

        } catch (error: any) {
            console.error('Error saving diary:', error);
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (diaryLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-background">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="p-8 shadow-lg" id="diary-form">
                <header className="flex items-start justify-between mb-4 border-b pb-4">
                    <AltekLogo className="h-10" />
                    <div className="text-right">
                        <h1 className="text-2xl font-bold tracking-tight text-primary">CONTRACTOR'S DAILY DIARY</h1>
                    </div>
                </header>
                
                <Card>
                    <CardHeader><CardTitle>Contract Details</CardTitle></CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="contractTitle" render={({ field }) => (<FormItem><FormLabel>Contract Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="contractNumber" render={({ field }) => (<FormItem><FormLabel>Contract Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent>
                </Card>

                <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <FormField control={form.control} name="area" render={({ field }) => (<FormItem><FormLabel>Area</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select area..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Mining">Mining</SelectItem><SelectItem value="Smelter">Smelter</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="hrs" render={({ field }) => (<FormItem><FormLabel>Total Hours</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="shiftStart" render={({ field }) => (<FormItem><FormLabel>Shift Start</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="shiftEnd" render={({ field }) => (<FormItem><FormLabel>Shift End</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                
                <Card className="mt-4">
                    <CardHeader><CardTitle>HSE</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="incidents" render={({ field }) => (<FormItem><FormLabel>Incidents / Accidents / Injuries</FormLabel><FormControl><VoiceTextarea {...field} value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="toolboxTalk" render={({ field }) => (<FormItem><FormLabel>Toolbox Talk</FormLabel><FormControl><VoiceTextarea {...field} value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent>
                </Card>
                
                {/* MANPOWER */}
                <Card className="mt-4">
                    <CardHeader>
                        <CardTitle>Manpower Utilized</CardTitle>
                        <CardDescription>Detail the personnel involved in the day's work.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Forecast</TableHead>
                                    <TableHead>Actual</TableHead>
                                    <TableHead>Normal Hrs</TableHead>
                                    <TableHead>O/T 1.5</TableHead>
                                    <TableHead>O/T 2.0</TableHead>
                                    <TableHead>Comments</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {manpowerFields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell><FormField control={form.control} name={`manpower.${index}.designation`} render={({ field }) => <Input {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`manpower.${index}.forecast`} render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`manpower.${index}.actual`} render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`manpower.${index}.normalHrs`} render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`manpower.${index}.overtime1_5`} render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`manpower.${index}.overtime2_0`} render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`manpower.${index}.comments`} render={({ field }) => <Input {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeManpower(index)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendManpower({})}><PlusCircle className="mr-2 h-4 w-4" />Add Manpower</Button>
                    </CardContent>
                </Card>

                {/* PLANT */}
                <Card className="mt-4">
                    <CardHeader><CardTitle>Plant & Equipment</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Insp. Done</TableHead><TableHead>Comments</TableHead><TableHead></TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {plantFields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell><FormField control={form.control} name={`plant.${index}.description`} render={({ field }) => <Input {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`plant.${index}.qty`} render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell>
                                            <FormField control={form.control} name={`plant.${index}.inspectionDone`} render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select>
                                            )} />
                                        </TableCell>
                                        <TableCell><FormField control={form.control} name={`plant.${index}.comments`} render={({ field }) => <Input {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removePlant(index)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendPlant({})}><PlusCircle className="mr-2 h-4 w-4" />Add Plant/Equipment</Button>
                    </CardContent>
                </Card>

                {/* WORKS */}
                <Card className="mt-4">
                    <CardHeader><CardTitle>Description of Works</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Area</TableHead><TableHead>Scope</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Hrs</TableHead><TableHead></TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {workFields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell><FormField control={form.control} name={`works.${index}.area`} render={({ field }) => <Input {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`works.${index}.scope`} render={({ field }) => <Input {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`works.${index}.timeStart`} render={({ field }) => <Input type="time" {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`works.${index}.timeEnd`} render={({ field }) => <Input type="time" {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><FormField control={form.control} name={`works.${index}.hrs`} render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} />} /></TableCell>
                                        <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeWork(index)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendWork({})}><PlusCircle className="mr-2 h-4 w-4" />Add Work Item</Button>
                    </CardContent>
                </Card>
                
                <Card className="mt-4">
                    <CardHeader><CardTitle>Delays & Comments</CardTitle></CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="delays" render={({ field }) => (<FormItem><FormLabel>Delays Encountered</FormLabel><FormControl><Textarea rows={5} placeholder="List each delay on a new line." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="comments" render={({ field }) => (<FormItem><FormLabel>General Comments</FormLabel><FormControl><Textarea rows={5} placeholder="List each comment on a new line." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent>
                </Card>

                <Card className="mt-4">
                    <CardHeader><CardTitle>Gallery</CardTitle></CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <ImageUploader title="Before Work" onImagesChange={setBeforeWorkFiles} />
                        <ImageUploader title="After Work" onImagesChange={setAfterWorkFiles} />
                    </CardContent>
                </Card>

                <Card className="mt-4">
                    <CardHeader><CardTitle>Signatures</CardTitle></CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="font-medium text-center">CONTRACTOR</h3>
                            <FormField control={form.control} name="contractorName" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="contractorDate" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="contractorSignature" render={({ field }) => (<FormItem><FormLabel>Signature</FormLabel><FormControl><SignaturePad value={field.value} onSign={field.onChange} onClear={() => field.onChange('')} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                         <div className="space-y-4">
                            <h3 className="font-medium text-center">CLIENT</h3>
                            <FormField control={form.control} name="clientName" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="clientDate" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="clientSignature" render={({ field }) => (<FormItem><FormLabel>Signature</FormLabel><FormControl><SignaturePad value={field.value} onSign={field.onChange} onClear={() => field.onChange('')} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </CardContent>
                </Card>
            </Card>

            <div className="flex justify-end gap-2 mt-8">
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {diaryId ? 'Save Changes' : 'Create Diary'}
                </Button>
            </div>
        </form>
      </Form>
    </div>
  );
}
