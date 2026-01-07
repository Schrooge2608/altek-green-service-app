'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import {
  CalendarIcon,
  Printer,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/ui/signature-pad';

function WorkCrewRow({ onRemove }: { onRemove: () => void }) {
  const [date, setDate] = React.useState<Date | undefined>();
  return (
    <TableRow>
      <TableCell>
        <Input placeholder="Name..." />
      </TableCell>
      <TableCell>
        <Input placeholder="RTBS No..." />
      </TableCell>
      <TableCell className="w-[180px]">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={'outline'}
              className={cn(
                'w-full justify-start text-left font-normal',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, 'PPP') : <span>Pick a date</span>}
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
      <TableCell className="w-[250px]">
        <SignaturePad />
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="print:hidden"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

const qualityControlItems = [
    { text: "Inspect isolator handle/mechanism for correct operation, including preventing door from being opened when in ON or LOCKOUT position." },
    { text: "Check for correct alignment of doors and ensure latching mechanisms are all operational. Lubricate rotating door mechanism with good quality electrical penetration oil. If locking mechanisms are worn, rectify immediately (especially if the panel/cubicle door doesn’t want to stay closed). Report to Plant Engineer if there is a serious issue." },
    { text: "Wash all door filters if the washable type filters are installed. Filters must be 100% dry before being re-fitted. Replace where necessary." },
    { text: "Inspect all internal covers that prevent inadvertent contact with “Live” busbars for cracks or missing screws/bolts. These covers are either of a poly type or metal mess design. Remove these covers to allow for better access for cleaning." },
    { text: "Vacuum clean entire cubicle or panel, take care not to disturb control and communication wiring." },
    { text: "Blow out VSD panels with blower only once vacuuming have been completed. Take care when blowing over delicate control wiring." },
    { text: "Inspect Power cable connections and bus bars for damage and hot connections (discoloration). Rectify immediately and capture findings in comments field." },
    { text: "Inspect condition of ribbon cables and make sure they are securely plugged in. Ensure that ribbon cable connectors latching clips (if equipt) are latched into position." },
    { text: "Check that ribbon cables are not resting on sharp edges or mains bus bars/terminations. Rectify if it is the case." },
    { text: "Inspect condition of control wiring cables and ensure they are not resting on sharp edges or bus bars/terminations." },
    { text: "Check all lugged terminals for loose connections and re-tighten where necessary." },
    { text: "Ensure that supply as well as the control fuses are of the correct ratings and located properly inside fuse holders. Inspect condition of fuse holders as well. Please note that special Ultra-Fast blow fuses are normally installed on power circuits of VSD’s." },
    { text: "Check cooling fan blades for cracks, free rotation and smooth bearing operation." },
];

export function VsdYearlyScopeDocument() {
    const title = "VSDs Yearly Service Scope";
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
                                variant={'outline'}
                                className={cn(
                                    'w-full justify-start text-left font-normal',
                                    !inspectionDate && 'text-muted-foreground'
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {inspectionDate ? format(inspectionDate, 'PPP') : <span>Pick a date</span>}
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
                <p>The annual service is the most comprehensive check, often requiring a scheduled shutdown. It focuses on deep diagnostics, component replacement, and verifying the integrity of the entire system to ensure another year of reliable operation.</p>
                
                <h3 className="mt-6 text-lg font-bold">Yearly VSD Service Schedule (The "Overhaul")</h3>
                <ol className="list-decimal pl-5 space-y-4">
                    <li>
                        <strong>Complete All 3 & 6-Month Checks:</strong> Perform all tasks from the quarterly and semi-annual schedules.
                    </li>
                    <li>
                        <strong>Component Replacement (Predictive Maintenance)</strong>
                        <ul className="list-disc pl-5 mt-2">
                            <li><strong>Cooling Fan Replacement:</strong> Most VSD cooling fans have a 2-3 year operational lifespan. Replace them annually in critical applications to prevent overheating.</li>
                            <li><strong>Terminal Block Replacement:</strong> If thermal imaging from previous checks showed any hot spots, replace the affected terminal blocks.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Firmware & Software</strong>
                        <ul className="list-disc pl-5 mt-2">
                            <li><strong>Update Firmware:</strong> Check the manufacturer’s website for the latest stable firmware version. Updates can improve performance, add features, and patch security vulnerabilities.</li>
                            <li><strong>Parameter Review:</strong> Compare the current parameters against the original commissioned settings. Document any changes and verify they were intentional and authorized.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Full System Diagnostics</strong>
                        <ul className="list-disc pl-5 mt-2">
                            <li><strong>Full Load Test:</strong> If possible, run the motor at 100% load and monitor the drive for stable current, voltage, and temperature.</li>
                            <li><strong>Backup & Restore Test:</strong> Perform a full parameter backup, factory reset the drive (with authorization), and then restore the parameters from the backup to ensure the backup file is valid.</li>
                        </ul>
                    </li>
                </ol>
            </div>

            <Separator className="my-8" />
            
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>VARIABLE SPEED DRIVE Quality Control Sheet</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Comments / Feedback</TableHead>
                                <TableHead className="text-center">Checked</TableHead>
                                <TableHead className="text-center">Not checked</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {qualityControlItems.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.text}</TableCell>
                                    <TableCell><Input placeholder="Comments..." /></TableCell>
                                    <TableCell className="text-center"><Checkbox /></TableCell>
                                    <TableCell className="text-center"><Checkbox /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <footer className="mt-16 text-xs text-muted-foreground text-center">
               <p>Altek Green - Confidential</p>
            </footer>
        </Card>
    </div>
  );
}
