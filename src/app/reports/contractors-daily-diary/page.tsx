'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { VoiceTextarea } from '@/components/ui/voice-textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { CalendarIcon, Printer, Save, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AltekLogo } from '@/components/altek-logo';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, setDocumentNonBlocking, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { DailyDiary, User } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const initialManpowerData = [
    { id: 1, designation: '', forecast: 1, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' },
    { id: 2, designation: '', forecast: 1, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' },
    { id: 3, designation: '', forecast: 2, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' },
    { id: 4, designation: '', forecast: 1, actual: 0, normalHrs: 0, overtime1_5: 0, overtime2_0: 0, totalManHrs: 0, comments: '' },
];


const plantRows = [
    { description: 'LDV - Single Cab' },
    { description: 'LDV - Double Cab' },
];

export default function NewDailyDiaryPage() {
    const [date, setDate] = React.useState<Date>();
    const [incidentsText, setIncidentsText] = useState('');
    const [toolboxTalkText, setToolboxTalkText] = useState('');
    const [uniqueId, setUniqueId] = useState('');
    const [isIdLoading, setIsIdLoading] = useState(true);
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    
    // Manpower state
    const [manpowerData, setManpowerData] = useState(initialManpowerData);

    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

    const userOptions = useMemo(() => {
        if (!users) return [];
        return users
            .filter(u => u.role !== 'Admin' && u.role !== 'Superadmin')
            .map(u => ({ label: u.name, value: u.name }));
    }, [users]);
    
    useEffect(() => {
        // Generate a simple, non-sequential unique ID to avoid database queries.
        setIsIdLoading(true);
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        setUniqueId(`AG-RBM-DD-${randomPart}`);
        setIsIdLoading(false);
    }, []);
    
    const handleSave = () => {
        if (!firestore || !uniqueId) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Database not available or ID not generated.',
            });
            return;
        }

        const diaryDocRef = doc(firestore, 'daily_diaries', uniqueId);
        
        const plainManpowerData = manpowerData.map(row => ({...row}));
        const finalDiaryData: Partial<DailyDiary> = { 
            id: uniqueId,
            date: date ? format(date, 'yyyy-MM-dd') : 'N/A',
            contractTitle: 'VSD MAINTENANCE', // Placeholder
            incidents: incidentsText,
            toolboxTalk: toolboxTalkText,
            manpower: plainManpowerData,
             // ... gather all other form fields
        };

        setDocumentNonBlocking(diaryDocRef, finalDiaryData, { merge: true });
        
        toast({
            title: 'Diary Saved',
            description: `Document ${uniqueId} has been saved successfully.`,
        });
        
        router.push(`/reports/contractors-daily-diary/${uniqueId}`);
    };

    const handleManpowerChange = (index: number, field: keyof typeof manpowerData[0], value: string) => {
        const newData = [...manpowerData];
        const parsedValue = (field !== 'designation' && field !== 'comments' && value !== '') ? parseFloat(value) : value;

        // @ts-ignore
        newData[index][field] = parsedValue;
        setManpowerData(newData);
    };

    const { forecastTotal, actualTotal } = useMemo(() => {
        const forecastTotal = manpowerData.reduce((sum, row) => sum + Number(row.forecast || 0), 0);
        const actualTotal = manpowerData.reduce((sum, row) => sum + Number(row.actual || 0), 0);
        return { forecastTotal, actualTotal };
    }, [manpowerData]);

     if (isUserLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }


    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-background">
            <div className="flex justify-end mb-4 gap-2 print:hidden">
                 <Button onClick={handleSave} disabled={!uniqueId || isIdLoading}>
                    <Save className="mr-2 h-4 w-4" /> Save Diary
                </Button>
                <Button onClick={() => window.print()} variant="outline">
                    <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
            </div>
            <Card className="p-8 shadow-lg" id="diary-form">
                <header className="flex items-start justify-between mb-4 border-b pb-4">
                    <AltekLogo className="h-10" />
                    <div className="text-right">
                        <h1 className="text-2xl font-bold tracking-tight text-primary">DAILY DIARY</h1>
                        <p className="text-sm text-muted-foreground font-mono">ID: {isIdLoading ? 'Generating...' : uniqueId}</p>
                    </div>
                </header>

                {/* Contract Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 text-sm items-end">
                    <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="contract-title">Contract Title</Label>
                            <Input id="contract-title" defaultValue="VSD MAINTENANCE" />
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="contract-number">Contract Number</Label>
                            <Input id="contract-number" defaultValue="CW 22038313" />
                        </div>
                    </div>
                     <div className="space-y-1">
                        <Label>Area</Label>
                        <RadioGroup defaultValue="mining" className="flex gap-4 pt-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="mining" id="mining" />
                                <Label htmlFor="mining">Mining</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="smelter" id="smelter" />
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
                        <Input id="shift-start" type="time" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="shift-end">Shift End</Label>
                        <Input id="shift-end" type="time" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="hrs">Hrs</Label>
                        <Input id="hrs" type="number" />
                    </div>
                </div>

                {/* Section A */}
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

                {/* Section B */}
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
                                    <TableHead className="w-[120px]">Normal Hrs worked</TableHead>
                                    <TableHead className="w-[120px]">1.5 Overtime</TableHead>
                                    <TableHead className="w-[120px]">2.0 Overtime</TableHead>
                                    <TableHead className="w-[120px]">Total Man Hrs</TableHead>
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
                                        <TableCell><Input type="number" step="0.1" value={row.normalHrs} onChange={(e) => handleManpowerChange(i, 'normalHrs', e.target.value)} /></TableCell>
                                        <TableCell><Input type="number" step="0.1" value={row.overtime1_5} onChange={(e) => handleManpowerChange(i, 'overtime1_5', e.target.value)} /></TableCell>
                                        <TableCell><Input type="number" step="0.1" value={row.overtime2_0} onChange={(e) => handleManpowerChange(i, 'overtime2_0', e.target.value)}/></TableCell>
                                        <TableCell><Input type="number" step="0.1" value={row.totalManHrs} onChange={(e) => handleManpowerChange(i, 'totalManHrs', e.target.value)}/></TableCell>
                                        <TableCell><Textarea rows={1} value={row.comments} onChange={(e) => handleManpowerChange(i, 'comments', e.target.value)}/></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                             <TableFooter>
                                <TableRow>
                                    <TableCell className="text-right font-bold">Totals</TableCell>
                                    <TableCell colSpan={2}>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label htmlFor="forecast-total" className="text-xs">Forecasted</Label>
                                                <Input id="forecast-total" type="number" value={forecastTotal} readOnly className="font-bold bg-muted" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="actual-total" className="text-xs">Actual</Label>
                                                <Input id="actual-total" type="number" value={actualTotal} readOnly className="font-bold bg-muted" />
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell colSpan={5}></TableCell>
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
                                {plantRows.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{row.description}</TableCell>
                                        <TableCell><Input type="number" /></TableCell>
                                        <TableCell>
                                            <RadioGroup className="flex gap-4">
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
                                        <TableCell><Textarea rows={1} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Section C */}
                <Card className="mb-4">
                    <CardHeader className="bg-muted p-2 rounded-t-lg">
                        <CardTitle className="text-sm">SECTION C: DESCRIPTION OF WORKS</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Area of Work</TableHead>
                                    <TableHead>Scope of Work</TableHead>
                                    <TableHead>Time Start</TableHead>
                                    <TableHead>Time End</TableHead>
                                    <TableHead>Hrs</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Input /></TableCell>
                                        <TableCell><Textarea rows={1} /></TableCell>
                                        <TableCell><Input type="time" /></TableCell>
                                        <TableCell><Input type="time" /></TableCell>
                                        <TableCell><Input type="number" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                {/* Section D */}
                 <Card className="mb-4">
                    <CardHeader className="bg-muted p-2 rounded-t-lg">
                        <CardTitle className="text-sm">SECTION D: DELAYS</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                         {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Label className="w-6 shrink-0">{i + 1}.</Label>
                                <Textarea rows={1} />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Section E */}
                <Card className="mb-4">
                    <CardHeader className="bg-muted p-2 rounded-t-lg">
                        <CardTitle className="text-sm">SECTION E: COMMENTS</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                         {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Label className="w-6 shrink-0">{i + 1}.</Label>
                                <Textarea rows={1} />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Signatures */}
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
