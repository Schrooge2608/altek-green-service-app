'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import { Printer, CalendarIcon, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import React from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import { SignaturePad } from '../ui/signature-pad';


function WorkCrewRow({ onRemove }: { onRemove: () => void }) {
    const [date, setDate] = React.useState<Date | undefined>();
    return (
        <TableRow>
            <TableCell><Input placeholder="Name..." /></TableCell>
            <TableCell><Input placeholder="RTBS No..." /></TableCell>
            <TableCell className="w-[180px]">
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </TableCell>
            <TableCell className="w-[250px]"><SignaturePad /></TableCell>
            <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={onRemove} className="print:hidden">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </TableCell>
        </TableRow>
    )
}

export function Vsd3MonthlyScopeDocument() {
  const title = "VSDs 3-Monthly Service Scope";
  const [selectedEquipment, setSelectedEquipment] = React.useState<string | undefined>();
  const [inspectionDate, setInspectionDate] = React.useState<Date | undefined>();
  const [crew, setCrew] = React.useState(() => [{ id: 1 }, { id: 2 }, { id: 3 }]);
  const firestore = useFirestore();

  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const addCrewMember = () => {
    setCrew(c => [...c, { id: Date.now() }]);
  };

  const removeCrewMember = (id: number) => {
    setCrew(c => c.filter(member => member.id !== id));
  };


  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
        <div className="flex justify-end mb-4 gap-2 print:hidden">
            <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
        </div>

        <Card className="p-8 shadow-lg border-2 border-primary/20 bg-card">
            <header className="flex items-start justify-between mb-8">
                <div>
                    <AltekLogo className="h-12 w-auto" />
                    <p className="text-muted-foreground mt-2">VSD & Equipment Services</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-primary">{title}</h2>
                    <p className="text-muted-foreground">Service Document</p>
                </div>
            </header>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Equipment Selection</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="equipment-select">Select Equipment for Inspection</Label>
                        <Select onValueChange={setSelectedEquipment} value={selectedEquipment} disabled={equipmentLoading}>
                            <SelectTrigger id="equipment-select">
                                <SelectValue placeholder="Select the equipment..." />
                            </SelectTrigger>
                            <SelectContent>
                            {equipmentLoading ? (
                                <SelectItem value="loading" disabled>Loading equipment...</SelectItem>
                            ) : (
                                equipment?.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.id})</SelectItem>)
                            )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="area">Area</Label>
                        <Input id="area" placeholder="e.g., MPA Pump Station" />
                    </div>
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !inspectionDate && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {inspectionDate ? format(inspectionDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                mode="single"
                                selected={inspectionDate}
                                onSelect={setInspectionDate}
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="inspected-by">Inspected By</Label>
                        <Input id="inspected-by" placeholder="Technician Name" />
                    </div>
                </CardContent>
            </Card>

            <div className="prose prose-sm max-w-none dark:prose-invert mt-8 space-y-6">
                <div>
                    <h3 className="text-lg font-bold">1. PURPOSE</h3>
                    <p>Mandatory inspections and services are needed to be carried out in order to identify, report and repair any unsafe conditions as well as to ensure reliable operation of electrical equipment.</p>
                </div>
                <div>
                    <h3 className="text-lg font-bold">2. DOCUMENTATION REQUIRED</h3>
                    <ul className="list-disc pl-5">
                        <li>Approved Risk Assessment (JHA)</li>
                        <li>RBM Take 5 Assessment Sheet</li>
                        <li>Critical Control Checklists (CCC) as identified by Risk Assessment</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-lg font-bold">3. JOB SPECIFIC SAFETY INFORMATION</h3>
                    <ul className="list-disc pl-5">
                        <li>Complete Take 5 and CCC’s.</li>
                        <li>Obtain permit to work.</li>
                        <li>Isolate units as per RBM isolation procedure.</li>
                        <li>Carry out service/inspection/test as per Quality Control Sheet below.</li>
                        <li>Cancel work permit after work completion.</li>
                    </ul>
                </div>
            </div>

            <div className="my-8">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>SAFETY</TableHead>
                            <TableHead>COMPLETED</TableHead>
                            <TableHead>SIGN</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">Take 5</TableCell>
                            <TableCell className="w-[150px] text-center"><Checkbox /></TableCell>
                            <TableCell className="w-[250px]"><SignaturePad /></TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">CCC</TableCell>
                            <TableCell className="w-[150px] text-center"><Checkbox /></TableCell>
                            <TableCell className="w-[250px]"><SignaturePad /></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            <div className="my-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Work Crew</h3>
                    <Button variant="outline" size="sm" onClick={addCrewMember} className="print:hidden">
                        <Plus className="mr-2 h-4 w-4" /> Add Crew Member
                    </Button>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>WORK CREW - NAME</TableHead>
                            <TableHead>RTBS NO.</TableHead>
                            <TableHead>DATE</TableHead>
                            <TableHead>SIGNATURE</TableHead>
                            <TableHead className="w-[50px] print:hidden"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {crew.map((member) => (
                            <WorkCrewRow key={member.id} onRemove={() => removeCrewMember(member.id)} />
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Separator className="my-8" />

            <div className="prose prose-sm max-w-none">
              <p>This document outlines the scope of work for the {title.toLowerCase()}.</p>
              <p className="mt-4 text-muted-foreground">(Placeholder content - details for this service scope will be added here.)</p>
            </div>
            
            <footer className="mt-16 text-xs text-muted-foreground text-center">
               <p>Altek Green - Confidential</p>
            </footer>
        </Card>
    </div>
  );
}

    