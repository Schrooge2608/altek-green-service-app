'use client';

import { notFound, useParams } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CompletedSchedule } from '@/lib/types';
import { AltekLogo } from '@/components/altek-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Check, X, Minus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

const statusIcons: Record<string, React.ReactNode> = {
    'checked': <Check className="h-5 w-5 text-green-600" />,
    'not-checked': <X className="h-5 w-5 text-destructive" />,
    'n/a': <Minus className="h-5 w-5 text-muted-foreground" />,
}

function PageSkeleton() {
    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8">
            <Skeleton className="h-10 w-32 mb-4 ml-auto" />
            <Card className="p-8">
                <header className="flex items-start justify-between mb-8">
                    <div>
                        <Skeleton className="h-12 w-40" />
                        <Skeleton className="h-4 w-32 mt-2" />
                    </div>
                    <div className="text-right">
                        <Skeleton className="h-8 w-64" />
                         <Skeleton className="h-4 w-24 mt-2 ml-auto" />
                    </div>
                </header>
                <Separator className="my-8" />
                <div className="grid grid-cols-3 gap-8 mb-8">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-20 w-full" />
                    </CardContent>
                </Card>
                <Card className="mt-8">
                    <CardHeader>
                        <Skeleton className="h-6 w-40" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-40 w-full" />
                    </CardContent>
                </Card>
            </Card>
        </div>
    )
}

export default function CompletedSchedulePage() {
    const params = useParams();
    const id = typeof params.id === 'string' ? params.id : '';
    const firestore = useFirestore();

    const scheduleRef = useMemoFirebase(() => doc(firestore, 'completed_schedules', id), [firestore, id]);
    const { data: schedule, isLoading } = useDoc<CompletedSchedule>(scheduleRef);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!schedule) {
        notFound();
        return null;
    }

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
                        <h2 className="text-2xl font-bold text-primary">Completed Service Document</h2>
                        <p className="text-muted-foreground">Doc ID: {schedule.id}</p>
                    </div>
                </header>
                
                <Separator className="my-8" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-sm">
                    <div>
                        <h3 className="font-semibold text-muted-foreground mb-2">EQUIPMENT</h3>
                        <p><strong>Name:</strong> {schedule.equipmentName}</p>
                        <p><strong>ID:</strong> {schedule.equipmentId}</p>
                        <p><strong>Area:</strong> {schedule.area}</p>
                    </div>
                     <div>
                        <h3 className="font-semibold text-muted-foreground mb-2">SERVICE DETAILS</h3>
                        <p><strong>Date:</strong> {schedule.completionDate}</p>
                        <p><strong>Type:</strong> {schedule.maintenanceType}</p>
                        <p><strong>Frequency:</strong> {schedule.frequency}</p>
                    </div>
                     <div>
                        <h3 className="font-semibold text-muted-foreground mb-2">INSPECTED BY</h3>
                        <p>{schedule.inspectedBy}</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Work Crew</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>RTBS No.</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Signature</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schedule.workCrew?.map((member, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{member.name}</TableCell>
                                        <TableCell>{member.rtbsNo}</TableCell>
                                        <TableCell>{member.date}</TableCell>
                                        <TableCell>
                                            {member.signature ? (
                                                <Image src={member.signature} alt={`Signature of ${member.name}`} width={120} height={40} className="object-contain" />
                                            ) : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>Maintenance Checklist</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Task</TableHead>
                                    <TableHead className="w-[100px] text-center">Status</TableHead>
                                    <TableHead>Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schedule.checklist?.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{item.task}</TableCell>
                                        <TableCell className="text-center">{statusIcons[item.status]}</TableCell>
                                        <TableCell>{item.comments || 'N/A'}</TableCell>
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
