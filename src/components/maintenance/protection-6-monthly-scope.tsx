
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
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Equipment, User } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad } from '@/components/ui/signature-pad';

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
    { text: "Visual inspection for physical damage, cracks, or signs of overheating on the breaker." },
    { text: "Manually operate the breaker (trip and reset) to ensure mechanical function is smooth." },
    { text: "Check torque on all load and line terminal connections." },
    { text: "Clean the breaker exterior and the surrounding area inside the panel." },
    { text: "Inspect auxiliary contacts and wiring for tightness and condition." },
    { text: "Verify that the amperage rating of the breaker is correct for the protected load." },
];

const commissioningItems = [
    { text: "Ensure downstream equipment is ready for power." },
    { text: "Close breaker and confirm it latches correctly." },
    { text: "With the load running, measure the current on all phases to check for balance." },
    { text: "Use a thermal imager to scan the breaker and connections for any hot spots under load." },
    { text: "Confirm any remote trip/close signals or status indicators are functioning correctly." },
    { text: "Leave area clean and ensure all panel covers are securely fastened." },
];

export function Protection6MonthlyScopeDocument() {
    const title = "Protection 6-Monthly Service Scope";
    const [selectedEquipment, setSelectedEquipment] = React.useState<string | undefined>();
    const [inspectionDate, setInspectionDate] = React.useState<Date | undefined>();
    const [crew, setCrew] = React.useState(() => [{ id: 1 }, { id: 2 }, { id: 3 }]);
    const firestore = useFirestore();
    const { user } = useUser();

    const equipmentQuery = useMemoFirebase(() => query(collection(firestore, 'equipment'), where('breakerModel', '!=', '')), [firestore]);
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
                        <Label htmlFor="equipment-select">Select Equipment (by Breaker)</Label>
                        <Select onValueChange={setSelectedEquipment} value={selectedEquipment} disabled={equipmentLoading}>
                            <SelectTrigger id="equipment-select">
                                <SelectValue placeholder="Select the equipment..." />
                            </SelectTrigger>
                            <SelectContent>
                            {equipmentLoading ? (
                                <SelectItem value="loading" disabled>Loading equipment...</SelectItem>
                            ) : (
                                equipment?.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.breakerModel})</SelectItem>)
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
                    <p>To ensure all circuit breakers and associated protection devices are in good working order, will operate correctly under fault conditions, and provide reliable protection for personnel and equipment.</p>
                </div>
                 <div>
                    <h3 className="text-lg font-bold">3. JOB SPECIFIC SAFETY INFORMATION</h3>
                    <ul className="list-disc pl-5">
                        <li>De-energize and Lockout/Tagout the panel or equipment before any work begins.</li>
                        <li>Verify zero energy state with a calibrated multimeter before touching any conductive parts.</li>
                        <li>Wear appropriate PPE, including arc-flash rated clothing if panel covers are removed on live adjacent sections.</li>
                        <li>Never assume a breaker is off just because the handle is in the "OFF" position. Test before touch.</li>
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
                            <TableCell className="font-medium">Take 5 & JHA</TableCell>
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

            <div className="prose prose-sm max-w-none dark:prose-invert">
                <h3 className="mt-6 text-lg font-bold">6-Month Protection Service (Circuit Breakers)</h3>
                <p>This service focuses on the physical and mechanical integrity of the circuit breaker. It is a critical check to ensure the device can physically do its job when called upon.</p>
            </div>
            
            <Separator className="my-8" />
            
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Protection Quality Control Sheet</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Comments / Feedback</TableHead>
                                <TableHead className="text-center w-[100px]">Checked</TableHead>
                                <TableHead className="text-center w-[100px]">N/A</TableHead>
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

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Commissioning & Final Checks</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Comments / Feedback</TableHead>
                                <TableHead className="text-center w-[100px]">Checked</TableHead>
                                <TableHead className="text-center w-[100px]">N/A</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {commissioningItems.map((item, index) => (
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
