
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Printer, Car, PersonStanding, Wind, Construction, Box, Zap, Ear, Biohazard, Flame, TrainTrack, Thermometer, Footprints } from 'lucide-react';
import React from 'react';
import { RbmLogo } from '@/components/rbm-logo';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const hazardIcons = [
  { icon: Car, label: 'Vehicle Collision' },
  { icon: PersonStanding, label: 'Vehicle Impact on Person' },
  { icon: Wind, label: 'Entanglement & Crushing' }, // Placeholder icon
  { icon: PersonStanding, label: 'Fall From Height' }, // Placeholder icon
  { icon: Footprints, label: 'Slipping & Tripping' },
  { icon: Zap, label: 'Uncontrolled Release of Energy' },
  { icon: Construction, label: 'Lifting Operations' },
  { icon: Box, label: 'Confined Space' },
  { icon: Zap, label: 'Contact with Electricity' },
  { icon: Ear, label: 'Noise' },
  { icon: Box, label: 'Falling Objects' }, // Placeholder icon
  { icon: Biohazard, label: 'Exposure to Hazardous Substances' },
  { icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 16.2-6.52-8.62a2 2 0 0 0-3.24 0L4.36 16.2a2 2 0 0 0 1.62 3.2h12.04a2 2 0 0 0 1.62-3.2Z"/></svg>, label: 'Slope Failure' },
  { icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5-5-2.2-5-5Z"/><path d="M12 12c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5-5-2.2-5-5Z"/><path d="M7 7c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5-5-2.2-5-5Z"/></svg>, label: 'Drowning' },
  { icon: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12s2.5-3 5-3 5 3 5 3-2.5 3-5 3-5-3-5-3Z"/><path d="M12 12s-2.5 3-5 3-5-3-5-3 2.5-3 5-3 5 3 5 3Z"/><circle cx="12" cy="12" r="3"/><path d="M12 4V2"/><path d="M12 22v-2"/><path d="m20 12-2 0"/><path d="m6 12-2 0"/><path d="m19 19-1.5-1.5"/><path d="m6.5 6.5-1.5-1.5"/><path d="m19 5-1.5 1.5"/><path d="m6.5 17.5-1.5 1.5"/></svg>, label: 'Radiation' },
  { icon: Flame, label: 'Contact with Molten Metal' },
  { icon: TrainTrack, label: 'Rail Collision' },
  { icon: PersonStanding, label: 'Rail Impact on Person' },
  { icon: Flame, label: 'Fire' },
  { icon: Thermometer, label: 'Hot and Cold Surfaces' },
];

export default function PermitToWorkPage() {

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-8 bg-background">
            <div className="flex justify-end mb-4 gap-2 print:hidden">
                <Button onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
            </div>
            <Card className="p-8 shadow-lg">
                <header className="grid grid-cols-2 mb-4 border-b-2 border-black pb-2">
                    <div>
                        <RbmLogo className="h-12 w-auto" />
                    </div>
                    <div className="text-right">
                        <div className="grid grid-cols-3 gap-2 items-center">
                            <Label htmlFor="permit-no" className="text-right font-bold">Permit Number:</Label>
                            <Input id="permit-no" className="col-span-2" />
                        </div>
                        <div className="flex justify-end items-center gap-4 mt-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox id="gptw" />
                                            <Label htmlFor="gptw">GPTW</Label>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>General Purpose Work Permit</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox id="mptw" />
                                            <Label htmlFor="mptw">MPTW</Label>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Master Permit to Work</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                         <div className="flex justify-end items-center gap-2 mt-2">
                             <Label className="font-bold">Valid Date From:</Label>
                             <Input type="date" className="w-auto"/>
                             <Label className="font-bold">To:</Label>
                             <Input type="date" className="w-auto"/>
                         </div>
                    </div>
                </header>

                 <p className="text-center font-bold text-sm bg-gray-200 p-1 my-4">This document is for the Client Manager to issue to the contractor</p>

                <section id="application">
                    <h2 className="text-lg font-bold bg-gray-300 px-2 py-1">A. APPLICATION</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-2 border">
                        <div className="space-y-1">
                            <Label htmlFor="purchase-order">Purchase order no:</Label>
                            <Input id="purchase-order" />
                        </div>
                        <div className="space-y-1">
                             <Label htmlFor="equipment">Permission is requested to work on the following equipment:</Label>
                            <Input id="equipment" />
                        </div>
                         <div className="col-span-full space-y-1">
                             <Label htmlFor="work-carried-out">Work to be carried out:</Label>
                            <Input id="work-carried-out" />
                        </div>
                        <div className="space-y-1">
                             <Label htmlFor="company-name">Company Name & No. of persons in team:</Label>
                            <Input id="company-name" />
                        </div>
                         <div className="space-y-1">
                             <Label htmlFor="contact-no">Contact No:</Label>
                            <Input id="contact-no" />
                        </div>
                    </div>
                </section>
                
                <section id="isolation-hazards" className="mt-4">
                    <h2 className="text-lg font-bold bg-gray-300 px-2 py-1">B. ISOLATION & HAZARDS</h2>
                    <div className="p-2 border mt-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-bold text-center mb-2">B1.1. Applicable Isolation Officer</h3>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fill in Applicable Box</TableHead>
                                            <TableHead>Yes</TableHead>
                                            <TableHead>Bar No</TableHead>
                                            <TableHead>Isolation Clearance Certificate Number</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {['CO Gas', 'Operations', 'Mechanical', 'Instrumentation', 'Confined Space', 'Refractory/maintainer', 'Electrical', 'Fire Systems', 'Mobile Equipment', 'Local Lockout'].map(item => (
                                            <TableRow key={item}>
                                                <TableCell>{item}</TableCell>
                                                <TableCell><Checkbox/></TableCell>
                                                <TableCell><Input className="h-8"/></TableCell>
                                                <TableCell><Input className="h-8"/></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div>
                                <h3 className="font-bold text-center mb-2">B1.2. Applicable Risks / Hazards - Tick applicable</h3>
                                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {hazardIcons.map(hazard => (
                                        <div key={hazard.label} className="flex flex-col items-center p-1 border rounded-md text-center">
                                            <hazard.icon className="h-8 w-8" />
                                            <Label htmlFor={`hazard-${hazard.label}`} className="text-xs mt-1 leading-tight">{hazard.label}</Label>
                                            <Checkbox id={`hazard-${hazard.label}`} className="mt-1" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t pt-4">
                            <div>
                                <h3 className="font-bold mb-2">B1.3. Specialized Control documentation required</h3>
                                <div className="space-y-2">
                                     {['Energized work / HT isolation log', 'Valid Working at Heights Authorisation form to be obtained', 'Confined Space Permit', 'Excavating / Trenching Authorization Certificate', 'Fire System Impediment Certificate', 'Radioactive Source Clearance Certificate', 'Mining Ponds - Face Inspection Checklist', 'Hotwork Clearance Certificate / No:'].map(item => (
                                        <div key={item} className="flex justify-between items-center">
                                            <Label>{item}</Label>
                                            <RadioGroup defaultValue="no" className="flex gap-4">
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id={`${item}-yes`} /><Label htmlFor={`${item}-yes`}>Yes</Label></div>
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="no" id={`${item}-no`} /><Label htmlFor={`${item}-no`}>No</Label></div>
                                            </RadioGroup>
                                        </div>
                                    ))}
                                </div>
                            </div>
                             <div>
                                <h3 className="font-bold mb-2">B2. Health/Safety/Environmental Precautions</h3>
                                <Textarea placeholder="Specific to the Task(s). INCLUDE THIS IN YOUR TAKE 5." />
                            </div>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t pt-4">
                             <div>
                                 <h3 className="font-bold mb-2">B2.1 Workplace Inspected</h3>
                                 <p className="text-sm mb-2">I, the authorised person, confirm that the correct isolations as per B1.1 is in place and specialised documents as per B1.3 have been completed.</p>
                                 <div className="grid grid-cols-2 gap-2 items-end">
                                     <Input placeholder="Authorized person/Workplace Inspector"/>
                                     <Input placeholder="Employee No"/>
                                     <div className="col-span-2"><SignaturePad/></div>
                                     <Input type="date"/>
                                     <Input type="time"/>
                                 </div>
                             </div>
                              <div>
                                 <h3 className="font-bold mb-2">B3. Permit Authorization</h3>
                                 <div className="grid grid-cols-2 gap-2 items-end mt-12">
                                     <Input placeholder="Authorized person"/>
                                     <Input placeholder="Employee No"/>
                                     <div className="col-span-2"><SignaturePad/></div>
                                     <Input type="date"/>
                                     <Input type="time"/>
                                 </div>
                             </div>
                         </div>
                         <div className="mt-4 border-t pt-4">
                            <h3 className="font-bold mb-2">B4. Permit Acceptance</h3>
                            <p className="text-sm mb-2">I, the applicant, understand and will apply the precautions as detailed in B1 & B2. I will comply with the specialised control documents required under B1.3. I will ensure that myself and my crew apply personal locks on the isolation stations specified in B1.1 and verify that work will only be done as specified in section A.</p>
                            <div className="grid grid-cols-3 gap-2 items-end">
                                <Input placeholder="Applicant"/>
                                <Input placeholder="Employee No"/>
                                <Input placeholder="Contact Number"/>
                                <div className="col-span-3"><SignaturePad/></div>
                                <Input type="date"/>
                                <Input type="time"/>
                            </div>
                         </div>
                    </div>
                </section>
                
                 <section id="cancellation-testing" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-2 border">
                            <h2 className="text-lg font-bold bg-gray-300 px-2 py-1 -m-2 mb-2">C1. CANCELLATION</h2>
                             <Label>Permit declared invalid for the following reason:</Label>
                             <Textarea className="my-2"/>
                            <div className="grid grid-cols-3 gap-2 items-end">
                                 <Input placeholder="Authorized person" className="col-span-3"/>
                                 <Input placeholder="Employee No"/>
                                 <Input type="date"/>
                                 <Input type="time"/>
                                 <div className="col-span-3"><SignaturePad/></div>
                            </div>
                        </div>
                         <div className="p-2 border">
                            <h2 className="text-lg font-bold bg-gray-300 px-2 py-1 -m-2 mb-2">C2. MOTOR DIRECTION TESTING</h2>
                            <div className="flex items-center gap-2 mb-2">
                                <Checkbox id="motor-test"/>
                                <Label htmlFor="motor-test">Permit invalid for the duration of Direction Testing only</Label>
                            </div>
                            <div className="grid grid-cols-3 gap-2 items-end">
                                 <Input placeholder="Applicant" className="col-span-3"/>
                                 <Input placeholder="Employee No"/>
                                 <Input type="date"/>
                                 <Input type="time"/>
                                 <div className="col-span-2">
                                    <Label className="text-xs">Sign In:</Label>
                                    <SignaturePad/>
                                 </div>
                                  <div className="col-span-1">
                                     <Label className="text-xs">Sign Out:</Label>
                                     <SignaturePad/>
                                 </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="completion" className="mt-4">
                    <h2 className="text-lg font-bold bg-gray-300 px-2 py-1">D. APPLICANT WORK COMPLETION DECLARATION</h2>
                    <div className="p-2 border mt-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between items-center my-2">
                                    <Label>The work detailed above has been completed</Label>
                                    <RadioGroup className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="yes"/><Label>Yes</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="no"/><Label>No</Label></div></RadioGroup>
                                </div>
                                <div className="flex justify-between items-center my-2">
                                    <Label>All persons under my control have been moved to a safe area</Label>
                                    <RadioGroup className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="yes"/><Label>Yes</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="no"/><Label>No</Label></div></RadioGroup>
                                </div>
                                <div className="flex justify-between items-center my-2">
                                    <Label>All personal locks have been removed</Label>
                                    <RadioGroup className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="yes"/><Label>Yes</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="no"/><Label>No</Label></div></RadioGroup>
                                </div>
                                <div className="flex justify-between items-center my-2">
                                    <Label>The equipment is safe for use and the area is clean and tidy</Label>
                                    <RadioGroup className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="yes"/><Label>Yes</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="no"/><Label>No</Label></div></RadioGroup>
                                </div>
                            </div>
                             <div>
                                <Label>General Comments:</Label>
                                <Textarea rows={6}/>
                             </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-4 items-end">
                            <Input placeholder="Applicant's Name"/>
                            <Input placeholder="Employee No"/>
                             <div className="row-span-2"><SignaturePad/></div>
                             <Input type="date"/>
                             <Input type="time"/>
                        </div>
                    </div>
                </section>

                <section id="acceptance" className="mt-4">
                    <h2 className="text-lg font-bold bg-gray-300 px-2 py-1">E. ACCEPTANCE</h2>
                    <div className="p-2 border mt-1">
                        <div className="grid grid-cols-3 gap-2 items-end">
                            <Input placeholder="Authorized person"/>
                            <Input placeholder="Employee No"/>
                             <div className="row-span-2"><SignaturePad/></div>
                             <Input type="date"/>
                             <Input type="time"/>
                        </div>
                    </div>
                </section>

            </Card>
        </div>
    );
}
