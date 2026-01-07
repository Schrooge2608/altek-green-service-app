'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import { Printer, AlertTriangle, CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import React from 'react';
import { Input } from '../ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '../ui/label';

const monthlyChecklist = [
    { task: 'Filter Inspection', action: 'If your VSD cabinet has air filters, check for clogs. A clogged filter is the #1 cause of over-temperature trips.' },
    { task: 'Cleaning', action: 'Use a vacuum (not compressed air, which can push conductive dust deeper into circuits) to remove dust from the heat sink fins.' },
    { task: 'Check Connections', action: 'Visually inspect power and control wiring for any signs of discoloration or pitting, which indicates loose connections causing heat.' },
    { task: 'Fan Operation', action: 'Verify that the internal cooling fans are moving air effectively and aren\'t wobbling.' },
];

const annualChecklist = [
    { component: 'Terminal Torque', action: 'Retighten all power connections to spec.', reason: 'Vibrations over time loosen screws, leading to arcing.' },
    { component: 'Capacitor Check', action: 'Look for bulging or leaking electrolyte.', reason: 'DC bus capacitors have a finite life (usually 5–10 years).' },
    { component: 'Voltage Balance', action: 'Measure input voltage phase-to-phase.', reason: 'Imbalance > 2% can cause significant internal heating.' },
    { component: 'Insulation Test', action: 'Perform a Megger test on the motor cables.', reason: 'Ensures the cable insulation hasn\'t degraded due to harmonics.' },
    { component: 'Software/Firmware', action: 'Check for manufacturer updates.', reason: 'Updates often include better motor control algorithms or bug fixes.' },
];

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

export function VsdMonthlyScopeDocument() {
  const title = "VSDs Monthly & Annual Service Scope";
  const [crew, setCrew] = React.useState(() => [{ id: 1 }, { id: 2 }, { id: 3 }]);
  const [selectedEquipment, setSelectedEquipment] = React.useState<string | undefined>();
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
            <AltekLogo className="h-12 w-auto" unoptimized />
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
          <CardContent>
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
          </CardContent>
        </Card>
        
        <div className="prose prose-sm max-w-none dark:prose-invert">
            <p className="lead">Building a comprehensive maintenance strategy involves shifting from simple monitoring to deep cleaning and electrical testing. Below is a structured template for Monthly and Annual VSD maintenance.</p>
        </div>

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

        <h3 className="text-xl font-bold mb-4">Monthly Maintenance: "The Deep Clean"</h3>
        <p className="text-sm text-muted-foreground mb-4">Monthly tasks focus on the physical health of the drive and ensuring that the cooling systems are actually working, not just spinning.</p>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-center">Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyChecklist.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.task}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox aria-label={`Check task ${item.task}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Separator className="my-8" />

        <h3 className="text-xl font-bold mb-4">Annual Maintenance: "The Technical Audit"</h3>
        <p className="text-sm text-muted-foreground mb-4">Once a year, the drive should be powered down (following strict Lockout/Tagout procedures) for a detailed health check.</p>
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-center">Checked</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {annualChecklist.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{item.component}</TableCell>
                            <TableCell>{item.action}</TableCell>
                            <TableCell>{item.reason}</TableCell>
                            <TableCell className="text-center">
                                <Checkbox aria-label={`Check task ${item.component}`} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>

        <Separator className="my-8" />
        
        <div className="grid md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>The VSD Life-Cycle Logic</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm dark:prose-invert">
                    <p>To keep your drives running for 10+ years, follow this logic for your schedule:</p>
                    <ul>
                        <li><strong>Weekly:</strong> Monitor (Eyes and Ears)</li>
                        <li><strong>Monthly:</strong> Clean (Airflow)</li>
                        <li><strong>Annually:</strong> Secure (Electrical Integrity)</li>
                    </ul>
                </CardContent>
            </Card>

            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>A Quick Warning on Safety</AlertTitle>
                <AlertDescription>
                   Important: VSDs contain large capacitors that hold a lethal electrical charge even after the power is turned off. Always wait the manufacturer-specified time (usually 5–15 minutes) and verify the DC bus voltage is at zero with a meter before touching any internal components.
                </AlertDescription>
            </Alert>
        </div>
        
        <footer className="mt-16 text-xs text-muted-foreground text-center">
          <p>Altek Green - Confidential</p>
        </footer>
      </Card>
    </div>
  );
}
