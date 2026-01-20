
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
import { Printer, CalendarIcon, Plus, Trash2, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useCollection, useFirestore, useMemoFirebase, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import type { Equipment, User, ScheduledTask } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';


const checklistItems = [
    { type: 'Acoustic Check', action: 'Listen for unusual noises.', lookFor: 'Grinding or clicking in cooling fans; humming or "singing" that sounds different than usual.' },
    { type: 'Visual Inspection', action: 'Check the exterior and environment.', lookFor: 'Excessive dust buildup on vents, signs of moisture/condensation, or any "burnt" smells.' },
    { type: 'Thermal Monitoring', action: 'Check the monitored temperature.', lookFor: "Ensure the internal temperature (available on the display) is within the manufacturer's spec." },
    { type: 'Environment Log', action: 'Record ambient conditions.', lookFor: 'Note the temperature and humidity of the room where the VSD is housed.' },
    { type: 'Electrical Logging', action: 'Record operating data.', lookFor: 'Log the DC Bus Voltage, Output Current, and Frequency. Sudden deviations can signal motor or capacitor issues.' },
    { type: 'Ventilation Check', action: 'Inspect airflow paths.', lookFor: 'Ensure that nothing is blocking the intake or exhaust of the drive cabinet.' },
];

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

export function VsdWeeklyScopeDocument({ schedule }: { schedule?: ScheduledTask }) {
  const title = "VSDs Weekly Service Scope";
  const [crew, setCrew] = useState(() => [{ id: 1 }, { id: 2 }, { id: 3 }]);
  const [selectedEquipment, setSelectedEquipment] = useState<string | undefined>(schedule?.equipmentId);
  const [inspectionDate, setInspectionDate] = useState<Date | undefined>(schedule ? new Date(schedule.scheduledFor) : undefined);
  const [inspectedById, setInspectedById] = useState<string | undefined>(schedule?.assignedToId);
  const [isSaving, setIsSaving] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

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
  
  const handleSaveToUpcoming = async () => {
    if (!selectedEquipment || !inspectionDate || !inspectedById) {
        toast({
            variant: 'destructive',
            title: 'Missing Information',
            description: 'Please select an equipment, date, and inspector before saving.'
        });
        return;
    }
    setIsSaving(true);
    
    const equipmentData = equipment?.find(e => e.id === selectedEquipment);
    const inspectorData = users?.find(u => u.id === inspectedById);
    
    if (!equipmentData || !inspectorData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find selected equipment or user.' });
        setIsSaving(false);
        return;
    }

    const newScheduledTask: Omit<ScheduledTask, 'id'> = {
        originalTaskId: `${equipmentData.id}-vsd-weekly`,
        equipmentId: equipmentData.id,
        equipmentName: equipmentData.name,
        task: 'VSD Weekly Service',
        scheduledFor: format(inspectionDate, 'yyyy-MM-dd'),
        status: 'Pending',
        assignedToId: inspectorData.id,
        assignedToName: inspectorData.name,
        completionNotes: '',
        component: 'VSD',
        frequency: 'Weekly',
    };

    try {
        const schedulesRef = collection(firestore, 'upcoming_schedules');
        const docRef = await addDocumentNonBlocking(schedulesRef, newScheduledTask);
        // Now update the document with its own ID
        await setDoc(doc(schedulesRef, docRef.id), { id: docRef.id }, { merge: true });

        toast({
            title: 'Schedule Saved',
            description: 'The task has been added to the upcoming schedules list.'
        });
        router.push('/maintenance/upcoming-schedules');
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the schedule.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!schedule) {
        toast({ variant: 'destructive', title: 'Error', description: 'No schedule data to complete.' });
        return;
    }
    // In a real app, this would collect all the form data (checklist, signatures, etc.)
    // and save it to a 'completed_schedules' collection.
    toast({ title: 'Functionality Pending', description: 'Completing and finalizing schedules is not yet fully implemented.' });
  };
  
  const isEditMode = !!schedule;


  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
      <div className="flex justify-end mb-4 gap-2 print:hidden">
        {isEditMode ? (
            <Button onClick={handleComplete} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save & Complete'}
            </Button>
        ) : (
             <Button variant="outline" onClick={handleSaveToUpcoming} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save to Upcoming Schedule List'}
            </Button>
        )}
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      <Card className="p-8 shadow-lg border-2 border-primary/20 bg-card">
        <header className="flex items-start justify-between mb-8">
          <div>
            <AltekLogo className="h-12 w-auto" unoptimized/>
            <p className="text-muted-foreground mt-2">VSD & Equipment Services</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-primary">{title}</h2>
            <p className="text-muted-foreground">Service Document</p>
            {isEditMode && <p className="text-xs text-muted-foreground font-mono mt-1">Doc #: {schedule.id}</p>}
          </div>
        </header>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Equipment Selection</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="equipment-select">Select Equipment for Inspection</Label>
                <Select onValueChange={setSelectedEquipment} value={selectedEquipment} disabled={equipmentLoading || isEditMode}>
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
                        disabled={isEditMode}
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
                 <Select onValueChange={setInspectedById} value={inspectedById} disabled={usersLoading || !user || isEditMode}>
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

        <h3 className="text-xl font-bold mb-4">Weekly Maintenance Checklist</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[75px]">Task Type</TableHead>
                <TableHead className="w-[200px]">Action Item</TableHead>
                <TableHead className="w-[250px]">What to Look For</TableHead>
                <TableHead className="text-center w-[100px]">Not Checked</TableHead>
                <TableHead className="text-center w-[100px]">Checked</TableHead>
                <TableHead>Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checklistItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.type}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>{item.lookFor}</TableCell>
                  <TableCell className="text-center">
                    <Checkbox aria-label={`Mark task ${item.type} as not checked`} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox aria-label={`Check task ${item.type}`} />
                  </TableCell>
                  <TableCell>
                    <Input placeholder="Comments..." />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Separator className="my-8" />

        <h3 className="text-xl font-bold mb-4">Electrical Log</h3>
        <Card>
            <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="dc-bus">DC Bus Voltage (V)</Label>
                            <Input id="dc-bus" type="number" placeholder="e.g., 540" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="output-current">Output Current (A)</Label>
                            <Input id="output-current" type="number" placeholder="e.g., 25.5" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="frequency">Frequency (Hz)</Label>
                            <Input id="frequency" type="number" placeholder="e.g., 50.1" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Reading Method</Label>
                        <RadioGroup defaultValue="vsd-display" className="mt-2 space-y-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="vsd-display" id="r1" />
                                <Label htmlFor="r1">Read from VSD Display</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="physically-measured" id="r2" />
                                <Label htmlFor="r2">Physically Measured</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <div className="mt-8 prose prose-sm max-w-none dark:prose-invert">
            <h3 className="text-xl font-bold mb-4">Pro-Tips for Weekly Upkeep</h3>
            <ul>
                <li><strong>The "Heat" Rule:</strong> For every 10°C rise in operating temperature, the lifespan of a VSD's capacitors is roughly halved. Weekly temperature logging is your best defense against premature aging.</li>
                <li><strong>Don't Open the Door (If Possible):</strong> For weekly checks, avoid opening the cabinet while the drive is energized unless you are wearing proper PPE and it is necessary for a reading. Most data can be pulled from the digital keypad/HMI.</li>
                <li><strong>Check the Fault History:</strong> Even if the drive hasn't tripped, check the fault log for "soft" warnings or auto-resets that happened during the week.</li>
            </ul>

            <h3 className="text-xl font-bold mt-6 mb-4">When to do more?</h3>
            <p>If your VSD is in a harsh environment (e.g., a sawmill with high dust or a pumping station with high humidity), you may need to move "Monthly" tasks like cleaning/replacing filters to your weekly schedule.</p>
        </div>
        
        <Separator className="my-8" />

        <h3 className="text-xl font-bold mb-4">Thermal Image Upload</h3>
        <Card>
            <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-1">
                        <Label htmlFor="thermal-image">Thermal Image of VSD</Label>
                        <Input id="thermal-image" type="file" className="file:text-foreground" />
                        <p className="text-xs text-muted-foreground">Upload a thermal image taken during the inspection.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="image-date">Date of Image</Label>
                        <Input id="image-date" type="date" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="image-time">Time of Image</Label>
                        <Input id="image-time" type="time" />
                    </div>
                </div>
            </CardContent>
        </Card>


        <footer className="mt-16 text-xs text-muted-foreground text-center">
          <p>Altek Green - Confidential</p>
        </footer>
      </Card>
    </div>
  );
}
