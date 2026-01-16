
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import React from 'react';
import { cn } from '@/lib/utils';


export default function ContractorsDailyDiaryPage() {
    const [date, setDate] = React.useState<Date>();

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-background">
            <Card className="p-8 shadow-lg">
                <header className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold tracking-tight text-primary">CONTRACTORS DAILY DIARY</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Image src="/RBM.png" alt="RBM Logo" width={80} height={80} />
                        <div className="grid gap-2 text-sm">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="sheet-number" className="text-right">Sheet Number</Label>
                                <Input id="sheet-number" className="w-32" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor="date" className="text-right">DATE</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-[180px] justify-start text-left font-normal",
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
                            </div>
                        </div>
                    </div>
                </header>

                <Separator className="my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-4 text-sm">
                    <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="contractor" className="text-right">Contractor</Label>
                            <Input id="contractor" className="col-span-2" />
                        </div>
                         <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="project-title" className="text-right">Project Title</Label>
                            <Input id="project-title" className="col-span-2" />
                        </div>
                         <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="project-no" className="text-right">Project No.</Label>
                            <Input id="project-no" className="col-span-2" />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="area" className="text-right">Area</Label>
                            <Input id="area" className="col-span-2" />
                        </div>
                    </div>
                    <div className="grid gap-2">
                         <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="contractor-order-no" className="text-right whitespace-nowrap">Contractor Order No.</Label>
                            <Input id="contractor-order-no" className="col-span-2" />
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="subordinate-manager" className="text-right whitespace-nowrap">Contractor Subordinate Manager</Label>
                            <Input id="subordinate-manager" className="col-span-2" />
                        </div>
                    </div>
                </div>

                <div className="space-y-2 mb-4">
                    <Label htmlFor="description-of-work">Description of work</Label>
                    <Textarea id="description-of-work" rows={4} />
                </div>
                
                <Table className="mb-4">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">SI No.</TableHead>
                            <TableHead>Description (eg. Safety)</TableHead>
                            <TableHead className="w-[100px]">CVI No.</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell><Input /></TableCell>
                            <TableCell><Input /></TableCell>
                            <TableCell><Input /></TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell><Input /></TableCell>
                            <TableCell><Input /></TableCell>
                            <TableCell><Input /></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
