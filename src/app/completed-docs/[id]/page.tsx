'use client';

import { notFound, useParams } from 'next/navigation';
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
import { Printer } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CompletedSchedule, Equipment } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

const statusVariantMap = {
    'checked': 'default',
    'not-checked': 'destructive',
    'n/a': 'secondary'
} as const;

export default function CompletedDocPage() {
    const params = useParams();
    const id = typeof params.id === 'string' ? params.id : '';
    const firestore = useFirestore();

    const scheduleRef = useMemoFirebase(() => doc(firestore, 'completed_schedules', id), [firestore, id]);
    const { data: schedule, isLoading } = useDoc<CompletedSchedule>(scheduleRef);
    
    const equipmentRef = useMemoFirebase(() => schedule ? doc(firestore, 'equipment', schedule.equipmentId) : null, [firestore, schedule]);
    const { data: equipment, isLoading: equipmentLoading } = useDoc<Equipment>(equipmentRef);

    if (isLoading || equipmentLoading) {
        return <div className="flex h-screen items-center justify-center">Loading document...</div>
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
                        <h2 className="text-2xl font-bold text-primary">{schedule.maintenanceType} {schedule.frequency} Service</h2>
                        <p className="text-muted-foreground">Completed Document</p>
                    </div>
                </header>

                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Service Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
                         <div>
                            <p><strong>Equipment:</strong> {schedule.equipmentName} ({schedule.equipmentId})</p>
                            <p><strong>Area / Location:</strong> {schedule.area}</p>
                         </div>
                         <div>
                            <p><strong>Completion Date:</strong> {schedule.completionDate}</p>
                            <p><strong>Inspected By:</strong> {schedule.inspectedBy}</p>
                         </div>
                    </CardContent>
                </Card>

                <Separator className="my-8" />

                <h3 className="text-xl font-bold mb-4">Work Crew</h3>
                <Card className="mb-8">
                    <CardContent className="pt-6">
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
                                {schedule.workCrew?.map((member, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{member.name}</TableCell>
                                        <TableCell>{member.rtbsNo}</TableCell>
                                        <TableCell>{member.date}</TableCell>
                                        <TableCell>
                                            {member.signature && <Image src={member.signature} alt={`Signature of ${member.name}`} width={150} height={75} />}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                <Separator className="my-8" />

                <h3 className="text-xl font-bold mb-4">Service Checklist</h3>
                 <Card>
                    <CardContent className="pt-6">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Task</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Comments</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schedule.checklist?.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{item.task}</TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariantMap[item.status]}>{item.status}</Badge>
                                        </TableCell>
                                        <TableCell>{item.comments}</TableCell>
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
