
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { VoiceTextarea } from '@/components/ui/voice-textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Printer, Save } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AltekLogo } from '@/components/altek-logo';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const manpowerRows = [
    { designation: 'Power Electronic Engineer', forecast: 1 },
    { designation: 'Power Electronic Technician', forecast: 1 },
    { designation: 'Field Service Technician', forecast: 2 },
    { designation: 'Assistant Technician', forecast: 1 },
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
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        // Generate a shorter random unique ID to avoid fetching the collection,
        // which is causing permission errors, and to make the ID more readable.
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        setUniqueId(`AG-RBM-DD-${randomPart}`);
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

        const diaryData = {
            id: uniqueId,
            date: date ? format(date, 'yyyy-MM-dd') : 'N/A',
            contractTitle: 'VSD MAINTENANCE', // Placeholder
            incidents: incidentsText,
            toolboxTalk: toolboxTalkText,
            // ... gather all other form fields
        };
        
        const diaryDocRef = doc(firestore, 'daily_diaries', uniqueId);

        setDocumentNonBlocking(diaryDocRef, diaryData, { merge: true });
        
        toast({
            title: 'Diary Saved',
            description: `Document ${uniqueId} has been saved successfully.`,
        });
        
        router.push('/reports/diary-tracker');
    };


    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-background">
            <div className="flex justify-end mb-4 gap-2 print:hidden">
                 <Button onClick={handleSave} disabled={!uniqueId}>
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
                        <p className="text-sm text-muted-foreground font-mono">ID: {uniqueId || 'Generating...'}</p>
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
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Forecast</TableHead>
                                    <TableHead>Actual</TableHead>
                                    <TableHead>Normal Hrs worked</TableHead>
                                    <TableHead>1.5 Overtime</TableHead>
                                    <TableHead>2.0 Overtime</TableHead>
                                    <TableHead>Total Man Hrs</TableHead>
                                    <TableHead>Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {manpowerRows.map((row, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{row.designation}</TableCell>
                                        <TableCell><Input type="number" defaultValue={row.forecast} /></TableCell>
                                        <TableCell><Input type="number" /></TableCell>
                                        <TableCell><Input type="number" step="0.1" /></TableCell>
                                        <TableCell><Input type="number" step="0.1" /></TableCell>
                                        <TableCell><Input type="number" step="0.1" /></TableCell>
                                        <TableCell><Input type="number" step="0.1" /></TableCell>
                                        <TableCell><Textarea rows={1} /></TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell colSpan={7} className="text-right font-bold">Total Workforce on site</TableCell>
                                    <TableCell><Input type="number" /></TableCell>
                                </TableRow>
                            </TableBody>
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
