
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Printer } from 'lucide-react';
import React from 'react';

export default function PermitToWorkPage() {

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background">
            <div className="flex justify-end mb-4 gap-2 print:hidden">
                <Button onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
            </div>
            <Card className="p-8 shadow-lg">
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-primary">PERMIT TO WORK</h1>
                </header>

                <Card className="mb-6">
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                            <Label htmlFor="permit-no">Permit No.</Label>
                            <Input id="permit-no" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="date">Date</Label>
                            <Input id="date" type="date" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="time">Time</Label>
                            <Input id="time" type="time" />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                            <Label htmlFor="location">Location of Work</Label>
                            <Input id="location" />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                            <Label htmlFor="description">Description of Work to be Performed</Label>
                            <Textarea id="description" rows={3} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Hazard Identification and Control</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <Label htmlFor="hazards">Hazards Identified</Label>
                            <Textarea id="hazards" rows={5} placeholder="List all potential hazards..." />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="precautions">Precautions to be Taken</Label>
                            <Textarea id="precautions" rows={5} placeholder="List all control measures..." />
                        </div>
                    </CardContent>
                </Card>
                
                <Separator className="my-6" />

                <h2 className="text-xl font-bold mb-4">Permit Authorization</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Permit Receiver</CardTitle>
                            <CardDescription>Person responsible for carrying out the work.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label>Name</Label>
                                <Input />
                            </div>
                            <div className="space-y-1">
                                <Label>Company</Label>
                                <Input />
                            </div>
                            <div className="space-y-1">
                                <Label>Signature</Label>
                                <SignaturePad />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1">
                                    <Label>Date</Label>
                                    <Input type="date" />
                                </div>
                                <div className="space-y-1">
                                    <Label>Time</Label>
                                    <Input type="time" />
                                </div>
                             </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Permit Issuer</CardTitle>
                            <CardDescription>Person authorizing the work to commence.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-1">
                                <Label>Name</Label>
                                <Input />
                            </div>
                            <div className="space-y-1">
                                <Label>Company</Label>
                                <Input />
                            </div>
                            <div className="space-y-1">
                                <Label>Signature</Label>
                                <SignaturePad />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1">
                                    <Label>Date</Label>
                                    <Input type="date" />
                                </div>
                                <div className="space-y-1">
                                    <Label>Time</Label>
                                    <Input type="time" />
                                </div>
                             </div>
                        </CardContent>
                    </Card>
                </div>
                
                <Separator className="my-8" />
                
                 <h2 className="text-xl font-bold mb-4">Permit Close Out</h2>
                 <Card>
                    <CardHeader>
                        <CardTitle>Acceptance of Handover</CardTitle>
                        <CardDescription>To be completed by the Permit Issuer upon work completion.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea placeholder="Work area left in a clean and safe condition. All tools and equipment removed. All guards replaced..." />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label>Issuer Name</Label>
                                    <Input />
                                </div>
                                <div className="space-y-1">
                                    <Label>Issuer Signature</Label>
                                    <SignaturePad />
                                </div>
                             </div>
                             <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-1">
                                        <Label>Date</Label>
                                        <Input type="date" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Time</Label>
                                        <Input type="time" />
                                    </div>
                                 </div>
                             </div>
                        </div>
                    </CardContent>
                 </Card>

            </Card>
        </div>
    );
}
