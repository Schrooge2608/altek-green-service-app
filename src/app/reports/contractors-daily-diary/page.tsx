
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { VoiceTextarea } from '@/components/ui/voice-textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { CalendarIcon, Printer, Save, Loader2, Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AltekLogo } from '@/components/altek-logo';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, setDocumentNonBlocking, useUser, useCollection, useMemoFirebase, useFirebase } from '@/firebase';
import { doc, collection, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DailyDiary, User as AppUser, User, WorkEntry, PlantEntry } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploader } from '@/components/image-uploader';


const initialManpowerData = [
    { id: 1, designation: '', forecast: 1, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' },
    { id: 2, designation: '', forecast: 1, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' },
    { id: 3, designation: '', forecast: 2, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' },
    { id: 4, designation: '', forecast: 1, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' },
];


const initialPlantRows = [
    { description: 'LDV - Single Cab' },
    { description: 'LDV - Double Cab' },
];

export default function NewDailyDiaryPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    const { firestore, firebaseApp } = useFirebase();
    const { user, isUserLoading } = useUser();

    const diaryId = searchParams.get('id');
    const equipmentNameFromQuery = searchParams.get('equipmentName');

    // State for all form fields
    const [uniqueId, setUniqueId] = useState('');
    const [contractTitle, setContractTitle] = useState('VSD MAINTENANCE');
    const [contractNumber, setContractNumber] = useState('CW 22038313');
    const [area, setArea] = useState<'Mining' | 'Smelter'>('Mining');
    const [date, setDate] = React.useState<Date>();
    const [shiftStart, setShiftStart] = useState('');
    const [shiftEnd, setShiftEnd] = useState('');
    const [hrs, setHrs] = useState<number | undefined>();
    const [incidentsText, setIncidentsText] = useState('');
    const [toolboxTalkText, setToolboxTalkText] = useState('');
    const [manpowerData, setManpowerData] = useState(initialManpowerData);
    const [plantData, setPlantData] = useState(initialPlantRows.map(p => ({...p, qty: '', inspectionDone: 'no', comments: ''})));
    const [delays, setDelays] = useState<string[]>(Array(5).fill(''));
    const [comments, setComments] = useState<string[]>(Array(5).fill(''));
    const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
    const [afterFiles, setAfterFiles] = useState<File[]>([]);
    
    const [isIdLoading, setIsIdLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const initialWorks = useMemo(() => {
        const works = Array(5).fill(null).map((_, i) => ({
            id: i,
            area: '',
            scope: '',
            timeStart: '',
            timeEnd: '',
            hrs: undefined,
        }));
        if (equipmentNameFromQuery && !diaryId) { // Only apply query param for new diaries
            works[0].scope = `Unscheduled work on: ${equipmentNameFromQuery}`;
        }
        return works;
    }, [equipmentNameFromQuery, diaryId]);

    const [works, setWorks] = useState(initialWorks);

    // Data fetching
    const diaryRef = useMemoFirebase(() => diaryId ? doc(firestore, 'daily_diaries', diaryId) : null, [firestore, diaryId]);
    const { data: diaryData, isLoading: diaryLoading } = useDoc<DailyDiary>(diaryRef);

    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

    const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userRole } = useDoc<AppUser>(userRoleRef);
    const isClientManager = userRole?.role === 'Client Manager';

    const userOptions = useMemo(() => {
        if (!users) return [];
        return users
            .filter(u => u.role !== 'Admin' && u.role !== 'Superadmin')
            .map(u => ({ label: u.name, value: u.name }));
    }, [users]);
    
    // Effect for setting form state from fetched data (edit mode)
    useEffect(() => {
        if (diaryData) {
            setContractTitle(diaryData.contractTitle || 'VSD MAINTENANCE');
            setContractNumber(diaryData.contractNumber || 'CW 22038313');
            setArea(diaryData.area || 'Mining');
            if (diaryData.date && diaryData.date !== 'N/A') setDate(new Date(diaryData.date));
            setShiftStart(diaryData.shiftStart || '');
            setShiftEnd(diaryData.shiftEnd || '');
            setHrs(diaryData.hrs);
            setIncidentsText(diaryData.incidents || '');
            setToolboxTalkText(diaryData.toolboxTalk || '');
            
            const populatedManpower = diaryData.manpower?.map((m, i) => ({ ...m, id: i })) || [];
            while(populatedManpower.length < 4) populatedManpower.push({ id: populatedManpower.length, ...initialManpowerData[0], designation: '' });
            setManpowerData(populatedManpower);

            const populatedWorks = diaryData.works?.map((w, i) => ({ ...w, id: i })) || [];
            while(populatedWorks.length < 5) populatedWorks.push({ id: populatedWorks.length, area: '', scope: '', timeStart: '', timeEnd: '', hrs: undefined });
            setWorks(populatedWorks);

            const populatedPlant = diaryData.plant?.map(p => ({...p, qty: p.qty || ''})) || [];
            while(populatedPlant.length < 2) populatedPlant.push({ description: initialPlantRows[populatedPlant.length]?.description || '', qty: '', inspectionDone: 'no', comments: '' });
            setPlantData(populatedPlant);

            const paddedDelays = diaryData.delays ? [...diaryData.delays] : [];
            while (paddedDelays.length < 5) paddedDelays.push('');
            setDelays(paddedDelays);
            
            const paddedComments = diaryData.comments ? [...diaryData.comments] : [];
            while (paddedComments.length < 5) paddedComments.push('');
            setComments(paddedComments);
        }
    }, [diaryData]);


    // Effect for setting the document ID
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

    // Effect for calculating total manpower hours
    useEffect(() => {
        const needsUpdate = manpowerData.some(row => {
            const normal = Number(row.normalHrs || 0);
            const ot1_5 = Number(row.overtime1_5 || 0);
            const ot2_0 = Number(row.overtime2_0 || 0);
            const total = normal + ot1_5 + ot2_0;
            return total !== Number(row.totalManHrs || 0);
        });

        if (needsUpdate) {
            setManpowerData(currentData =>
                currentData.map(row => {
                    const normal = Number(row.normalHrs || 0);
                    const ot1_5 = Number(row.overtime1_5 || 0);
                    const ot2_0 = Number(row.overtime2_0 || 0);
                    return {
                        ...row,
                        totalManHrs: normal + ot1_5 + ot2_0
                    };
                })
            );
        }
    }, [manpowerData]);
    
    const handleSave = async () => {
      // BB's debug function - do not change
      try {
        // Using user from useUser() hook.
    
        // 1. SAFETY CHECK: Are we logged in?
        if (!user) {
          alert("STOP: You are not logged in. The app cannot save.");
          return;
        }
    
        console.log("1. User Found:", user.uid);
    
        // 2. PREPARE THE DATA (The "Key")
        const newDiaryData = {
          userId: user.uid,            // <--- CRITICAL: Must match auth.uid
          isSignedOff: false,          // <--- CRITICAL: Must be false
          createdAt: serverTimestamp(), // <--- CRITICAL: Timestamp
          content: "New Entry",        // Placeholder content
          status: "Draft"
        };
    
        console.log("2. Sending this data:", newDiaryData);
    
        // 3. SEND TO FIREBASE
        await addDoc(collection(firestore, 'daily_diaries'), newDiaryData);
        
        alert("SUCCESS! The document was saved.");
    
      } catch (error) {
        console.error("SAVE FAILED:", error);
        alert("STILL FAILING: " + (error as Error).message);
      }
    };

    const handleManpowerChange = (index: number, field: keyof typeof manpowerData[0], value: string | number) => {
        const newData = [...manpowerData];
        // @ts-ignore
        newData[index][field] = value;
        setManpowerData(newData);
    };

    const handleWorkChange = (index: number, field: keyof Omit<WorkEntry, 'id'>, value: string) => {
        const newWorks = [...works];
        const item = newWorks[index];
        // @ts-ignore
        item[field] = value;
        setWorks(newWorks);
    };
    
    const handlePlantChange = (index: number, field: string, value: string) => {
        const newData = [...plantData];
        // @ts-ignore
        newData[index][field] = value;
        setPlantData(newData);
    };

    const handleArrayInputChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
        setter(prev => {
            const newArr = [...prev];
            newArr[index] = value;
            return newArr;
        });
    };

    const { forecastTotal, actualTotal, normalHrsTotal, overtime1_5_Total, overtime2_0_Total, totalManHrsTotal } = useMemo(() => {
        return manpowerData.reduce((acc, row) => {
            acc.forecastTotal += Number(row.forecast || 0);
            acc.actualTotal += Number(row.actual || 0);
            acc.normalHrsTotal += Number(row.normalHrs || 0);
            acc.overtime1_5_Total += Number(row.overtime1_5 || 0);
            acc.overtime2_0_Total += Number(row.overtime2_0 || 0);
            acc.totalManHrsTotal += Number(row.totalManHrs || 0);
            return acc;
        }, {
            forecastTotal: 0,
            actualTotal: 0,
            normalHrsTotal: 0,
            overtime1_5_Total: 0,
            overtime2_0_Total: 0,
            totalManHrsTotal: 0,
        });
    }, [manpowerData]);

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
                 <Button onClick={handleSave} disabled={!uniqueId || isIdLoading || isClientManager || isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSaving ? 'Saving...' : 'Save Diary'}
                </Button>
                <Button onClick={() => window.print()} variant="outline">
                    <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
            </div>
            <Card className="p-8 shadow-lg" id="diary-form">
                <header className="flex items-start justify-between mb-4 border-b pb-4">
                    <AltekLogo className="h-10" />
                    <div className="text-right">
                        <h1 className="text-2xl font-bold tracking-tight text-primary">{diaryId ? 'Edit Daily Diary' : 'DAILY DIARY'}</h1>
                        <p className="text-sm text-muted-foreground font-mono">ID: {isIdLoading ? 'Generating...' : uniqueId}</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 text-sm items-end">
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="contract-title">Contract Title</Label>
                            <Input id="contract-title" value={contractTitle} onChange={e => setContractTitle(e.target.value)} />
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="contract-number">Contract Number</Label>
                            <Input id="contract-number" value={contractNumber} onChange={e => setContractNumber(e.target.value)} />
                        </div>
                    </div>
                     <div className="space-y-1">
                        <Label>Area</Label>
                        <RadioGroup value={area} onValueChange={(v) => setArea(v as 'Mining' | 'Smelter')} className="flex gap-4 pt-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Mining" id="mining" />
                                <Label htmlFor="mining">Mining</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Smelter" id="smelter" />
                                <Label htmlFor="smelter">Smelter</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="date">Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    <div className="space-y-1">
                        <Label htmlFor="shift-start">Shift Start</Label>
                        <Input id="shift-start" type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="shift-end">Shift End</Label>
                        <Input id="shift-end" type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="hrs">Hrs</Label>
                        <Input id="hrs" type="number" value={hrs} onChange={e => setHrs(Number(e.target.value))} />
                    </div>
                </div>

                <Card className="mb-4">
                    <CardHeader className="bg-muted p-2 rounded-t-lg">
                        <CardTitle className="text-sm">SECTION A: HSE</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="incidents">Incidents/Accidents/Injuries</Label>
                            <VoiceTextarea id="incidents" rows={2} value={incidentsText} onChange={setIncidentsText} />
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="toolbox-talk">Toolbox Talk</Label>
                            <VoiceTextarea id="toolbox-talk" rows={2} value={toolboxTalkText} onChange={setToolboxTalkText} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="mb-4">
                     <CardHeader className="bg-muted p-2 rounded-t-lg">
                        <CardTitle className="text-sm">SECTION B: MANPOWER AND PLANT</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[250px]">Designation</TableHead>
                                    <TableHead className="w-[100px]">Forecast</TableHead>
                                    <TableHead className="w-[100px]">Actual</TableHead>
                                    <TableHead className="w-[120px]">Normal Hrs</TableHead>
                                    <TableHead className="w-[120px]">1.5 OT</TableHead>
                                    <TableHead className="w-[120px]">2.0 OT</TableHead>
                                    <TableHead className="w-[120px]">Total Hrs</TableHead>
                                    <TableHead>Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {manpowerData.map((row, i) => (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            <Select
                                                onValueChange={(value) => handleManpowerChange(i, 'designation', value)}
                                                value={row.designation}
                                                disabled={usersLoading}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select user..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {usersLoading ? (
                                                        <SelectItem value="loading" disabled>Loading users...</SelectItem>
                                                    ) : (
                                                        userOptions.map(option => (
                                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell><Input type="number" value={row.forecast} onChange={(e) => handleManpowerChange(i, 'forecast', e.target.value)} /></TableCell>
                                        <TableCell><Input type="number" value={row.actual} onChange={(e) => handleManpowerChange(i, 'actual', e.target.value)} /></TableCell>
                                        <TableCell><Input type="number" step="0.1" value={row.normalHrs} onChange={(e) => handleManpowerChange(i, 'normalHrs', e.target.value)} className="w-[80px]" /></TableCell>
                                        <TableCell><Input type="number" step="0.1" value={row.overtime1_5} onChange={(e) => handleManpowerChange(i, 'overtime1_5', e.target.value)} className="w-[80px]" /></TableCell>
                                        <TableCell><Input type="number" step="0.1" value={row.overtime2_0} onChange={(e) => handleManpowerChange(i, 'overtime2_0', e.target.value)} className="w-[80px]" /></TableCell>
                                        <TableCell><Input type="number" value={row.totalManHrs} readOnly className="w-[80px] bg-muted" /></TableCell>
                                        <TableCell><Textarea rows={1} value={row.comments} onChange={(e) => handleManpowerChange(i, 'comments', e.target.value)}/></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                             <TableFooter>
                                <TableRow>
                                    <TableCell className="text-right font-bold">Totals</TableCell>
                                    <TableCell>
                                        <Input type="number" value={forecastTotal} readOnly className="font-bold bg-muted" />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={actualTotal} readOnly className="font-bold bg-muted" />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={normalHrsTotal} readOnly className="font-bold bg-muted w-[80px]" />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={overtime1_5_Total} readOnly className="font-bold bg-muted w-[80px]" />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={overtime2_0_Total} readOnly className="font-bold bg-muted w-[80px]" />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={totalManHrsTotal} readOnly className="font-bold bg-muted w-[80px]" />
                                    </TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Plant description</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Daily Inspection Done</TableHead>
                                    <TableHead>Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {plantData.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{row.description}</TableCell>
                                        <TableCell><Input type="number" value={row.qty} onChange={(e) => handlePlantChange(i, 'qty', e.target.value)} /></TableCell>
                                        <TableCell>
                                            <RadioGroup className="flex gap-4" value={row.inspectionDone} onValueChange={val => handlePlantChange(i, 'inspectionDone', val)}>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="yes" id={`plant-y-${i}`} />
                                                    <Label htmlFor={`plant-y-${i}`}>Y</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="no" id={`plant-n-${i}`} />
                                                    <Label htmlFor={`plant-n-${i}`}>N</Label>
                                                </div>
                                            </RadioGroup>
                                        </TableCell>
                                        <TableCell><Textarea rows={1} value={row.comments} onChange={(e) => handlePlantChange(i, 'comments', e.target.value)}/></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="mb-4">
                    <CardHeader className="bg-muted p-2 rounded-t-lg">
                        <CardTitle className="text-sm">SECTION C: DESCRIPTION OF WORKS</CardTitle>
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {works.map((work, i) => (
                                    <TableRow key={work.id}>
                                        <TableCell><Input value={work.area} onChange={e => handleWorkChange(i, 'area', e.target.value)}/></TableCell>
                                        <TableCell><Textarea rows={1} value={work.scope} onChange={e => handleWorkChange(i, 'scope', e.target.value)}/></TableCell>
                                        <TableCell><Input type="time" value={work.timeStart} onChange={e => handleWorkChange(i, 'timeStart', e.target.value)}/></TableCell>
                                        <TableCell><Input type="time" value={work.timeEnd} onChange={e => handleWorkChange(i, 'timeEnd', e.target.value)}/></TableCell>
                                        <TableCell><Input type="number" className="w-[70px]" value={work.hrs === undefined ? '' : work.hrs} onChange={e => handleWorkChange(i, 'hrs', e.target.value)}/></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                 <Card className="mb-4">
                    <CardHeader className="bg-muted p-2 rounded-t-lg">
                        <CardTitle className="text-sm">SECTION D: DELAYS</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                         {delays.map((delay, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Label className="w-6 shrink-0">{i + 1}.</Label>
                                <Textarea rows={1} value={delay} onChange={e => handleArrayInputChange(setDelays, i, e.target.value)} />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="mb-4">
                    <CardHeader className="bg-muted p-2 rounded-t-lg">
                        <CardTitle className="text-sm">SECTION E: COMMENTS</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                         {comments.map((comment, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Label className="w-6 shrink-0">{i + 1}.</Label>
                                <Textarea rows={1} value={comment} onChange={e => handleArrayInputChange(setComments, i, e.target.value)} />
                            </div>
                        ))}
                    </CardContent>
                </Card>

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
                                <Input />
                            </div>
                             <div className="space-y-1">
                                <Label>Signature</Label>
                                <SignaturePad />
                            </div>
                             <div className="space-y-1">
                                <Label>Date</Label>
                                <Input type="date" />
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
                                <Input />
                            </div>
                             <div className="space-y-1">
                                <Label>Signature</Label>
                                <SignaturePad />
                            </div>
                             <div className="space-y-1">
                                <Label>Date</Label>
                                <Input type="date" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </Card>
        </div>
    );
}

