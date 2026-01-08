
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Printer, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import React from 'react';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from './ui/calendar';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment, User } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Checkbox } from './ui/checkbox';
import { SignaturePad } from './ui/signature-pad';


interface MaintenanceScopeDocumentProps {
  title: string;
}

function WorkCrewRow({ onRemove, users, usersLoading }: { onRemove: () => void, users: User[] | null, usersLoading: boolean }) {
    const [date, setDate] = React.useState<Date | undefined>();
    return (
        <TableRow>
            <TableCell>
                 <Select disabled={usersLoading}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select crew member..." />
                    </SelectTrigger>
                    <SelectContent>
                    {usersLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : (
                        users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)
                    )}
                    </SelectContent>
                </Select>
            </TableCell>
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

export function MaintenanceScopeDocument({ title }: MaintenanceScopeDocumentProps) {
    const [selectedEquipment, setSelectedEquipment] = React.useState<string | undefined>();
    const [inspectionDate, setInspectionDate] = React.useState<Date | undefined>();
    const [crew, setCrew] = React.useState(() => [{ id: 1 }, { id: 2 }, { id: 3 }]);
    const firestore = useFirestore();
    const { user } = useUser();

    const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
    const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

    const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

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
                        <Select disabled={usersLoading || !user}>
                            <SelectTrigger id="inspected-by">
                                <SelectValue placeholder="Select technician..." />
                            </SelectTrigger>
                            <SelectContent>
                            {usersLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : (
                                users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)
                            )}
                            </SelectContent>
                        </Select>
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
                            <WorkCrewRow key={member.id} onRemove={() => removeCrewMember(member.id)} users={users} usersLoading={usersLoading} />
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Alert variant="destructive" className="my-8">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Safety Warning</AlertTitle>
                <AlertDescription>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Always make sure you identify any control voltages that might be present inside the VSD panel.</li>
                        <li>A lethally dangerous voltage is present in the VSD even after isolation. Ensure that the VSD is safe to work on by applying the “test before touch” principle. The capacitors might need time to completely discharge to zero potential.</li>
                        <li>Live voltages in VSD’s once switched on pose a flash over risk. Arc rated PPE (Minimum Cat 2) and only insulated tools must be used.</li>
                        <li>During the cleaning process excessive dust, pose a risk. To mitigate in cases of excessive dust, wear a dust mask.</li>
                        <li>During the cleaning process when making use of an electrical blower loose flying objects, pose a risk. Use correct safety glasses/goggles to mitigate against eye injury.</li>
                        <li>Do not brush or blow dust into protection relays, control equipment or switchgear mechanisms.</li>
                    </ul>
                </AlertDescription>
            </Alert>
            <div className="prose prose-sm max-w-none dark:prose-invert">
                <p>A 3-month (Quarterly) service schedule is often considered the "sweet spot" for industrial maintenance. It bridges the gap between simple visual checks and the major annual shutdown.</p>
                <p>At the 3-month mark, the goal is proactive prevention—catching the "silent killers" like loose terminals and parameter drift before they cause a breakdown.</p>

                <h3 className="mt-6 text-lg font-bold">3-Month VSD Service Schedule</h3>
                <ol className="list-decimal pl-5 space-y-4">
                    <li>
                        <strong>Safety & Preparation</strong>
                        <ul className="list-disc pl-5 mt-2">
                            <li><strong>Lockout/Tagout (LOTO):</strong> Isolate power and wait for the DC bus to discharge (verify with a meter—usually 5–15 mins).</li>
                            <li><strong>PPE:</strong> Wear appropriate arc flash protection and use insulated tools.</li>
                            <li><strong>Backup:</strong> If the drive is still powered, export the current parameter set to a laptop or USB keypad.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Electrical Integrity (The "Tightness" Check)</strong>
                        <ul className="list-disc pl-5 mt-2">
                            <li><strong>Re-Torque Terminals:</strong> Check the tightness of all power input (L1, L2, L3) and output (U, V, W) connections. Vibrations and thermal cycling naturally loosen these over 90 days.</li>
                            <li><strong>Control Wiring:</strong> Tug-test small control wires (Start/Stop, Speed Ref) to ensure they haven't vibrated loose.</li>
                            <li><strong>Grounding:</strong> Inspect the ground strap for corrosion or loose bolts.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Thermal & Physical Health</strong>
                        <ul className="list-disc pl-5 mt-2">
                            <li><strong>Heat Sink Cleaning:</strong> Use a vacuum or dry, oil-free compressed air to blow out the heat sink fins from the bottom up.</li>
                            <li><strong>Thermal Imaging:</strong> If the drive is running, use an IR camera to look for "hot spots" on terminal blocks or the main DC bus capacitors.</li>
                            <li><strong>Capacitor Inspection:</strong> Visually check for "crowning" (bulging tops) or leaking fluid.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Performance & Data Analysis</strong>
                        <ul className="list-disc pl-5 mt-2">
                            <li><strong>Fault Log Review:</strong> Download the last 3 months of fault history. Look for recurring "Under-voltage" or "Over-current" warnings that didn't trip the drive but indicate a brewing problem.</li>
                            <li><strong>DC Bus Ripple Test:</strong> Measure the AC ripple on the DC bus. If it’s rising (typically &gt;5V AC), your capacitors are starting to fail.</li>
                            <li><strong>I/O Verification:</strong> Test that the Emergency Stop (E-Stop) and any safety interlocks still function correctly.</li>
                        </ul>
                    </li>
                </ol>
            </div>


            <Separator className="my-8" />
            
            <footer className="mt-16 text-xs text-muted-foreground text-center">
               <p>Altek Green - Confidential</p>
            </footer>
        </Card>
    </div>
  );
}
