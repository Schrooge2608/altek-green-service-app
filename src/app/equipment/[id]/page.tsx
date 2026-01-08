
'use client';

import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, User, Shield, Wrench, Cpu } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Equipment, Breakdown, VSD } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import React, { useMemo } from 'react';

const imageMap: { [key: string]: string } = {
    Pump: "pump-1",
    Fan: "fan-1",
    Compressor: "compressor-1",
    "Utility Room": "dashboard-hero"
};

function EquipmentDetailSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <header className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-9 w-1/2" />
                    <Skeleton className="h-4 w-1/3 mt-2" />
                </div>
                <Skeleton className="h-10 w-24" />
            </header>
             <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle><Skeleton className="h-7 w-1/4" /></CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-6">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </CardContent>
                    </Card>
                    <Card>
                         <CardHeader>
                            <CardTitle><Skeleton className="h-7 w-1/3" /></CardTitle>
                        </CardHeader>
                        <CardContent>
                           <Skeleton className="h-40 w-full" />
                        </CardContent>
                    </Card>
                </div>
                 <div className="space-y-8">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </div>
        </div>
    );
}

function VSDInfo({ vsdId }: { vsdId: string }) {
    const firestore = useFirestore();
    const vsdRef = useMemoFirebase(() => doc(firestore, 'vsds', vsdId), [firestore, vsdId]);
    const { data: vsd, isLoading: vsdLoading } = useDoc<VSD>(vsdRef);

    if (vsdLoading) {
        return (
            <div className="mt-2 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-20" />
            </div>
        );
    }

    if (!vsd) {
        return <p>VSD information not available.</p>;
    }

    return (
         <div className="mt-2 space-y-1">
            <p><strong>VSD ID:</strong> {vsd.id}</p>
            <p><strong>VSD Model:</strong> {vsd.model || 'N/A'}</p>
            <div><strong>Status:</strong> <Badge variant={vsd.status === 'active' ? 'default' : (vsd.status === 'maintenance' ? 'secondary' : 'destructive')}>{vsd.status || 'Unknown'}</Badge></div>
            {vsd.assignedToName && <p><strong>Technician:</strong> {vsd.assignedToName}</p>}
        </div>
    );
}

export default function EquipmentDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const firestore = useFirestore();
  
  const eqRef = useMemoFirebase(() => (id ? doc(firestore, 'equipment', id) : null), [firestore, id]);
  const { data: eq, isLoading: eqLoading } = useDoc<Equipment>(eqRef);

  const vsdRef = useMemoFirebase(() => (eq ? doc(firestore, 'vsds', eq.vsdId) : null), [firestore, eq]);
  const { data: vsd, isLoading: vsdLoading } = useDoc<VSD>(vsdRef);

  const breakdownsQuery = useMemoFirebase(() => (id ? query(collection(firestore, 'breakdown_reports'), where('equipmentId', '==', id)) : null), [firestore, id]);
  const { data: eqBreakdowns, isLoading: breakdownsLoading } = useCollection<Breakdown>(breakdownsQuery);

  const uptimePercentage = useMemo(() => {
    if (!vsd?.installationDate || !eq) return 100;
    const installationDate = new Date(vsd.installationDate);
    const now = new Date();
    const totalHours = (now.getTime() - installationDate.getTime()) / (1000 * 60 * 60);
    if (totalHours <= 0) return 100;

    const downtimeHours = eq.totalDowntimeHours || 0;
    const uptimeHours = totalHours - downtimeHours;
    
    return Math.max(0, (uptimeHours / totalHours) * 100);

  }, [eq, vsd]);

  if (eqLoading || vsdLoading) {
    return <EquipmentDetailSkeleton />;
  }

  if (!eq) {
    notFound();
    return null; // notFound() throws an error, but this is needed for type safety
  }
  
  const defaultPlaceholder = eq.type && imageMap[eq.type] ? PlaceHolderImages.find(p => p.id === imageMap[eq.type]) : PlaceHolderImages.find(p => p.id === 'dashboard-hero');
  const imageUrl = eq.imageUrl || defaultPlaceholder?.imageUrl;
  const imageHint = defaultPlaceholder?.imageHint || 'industrial equipment';
  
  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">{eq.name}</h1>
            <p className="text-muted-foreground">Detailed view of equipment ID: {eq.id}</p>
        </div>
        <Link href={`/equipment/${id}/edit`} passHref>
            <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit Equipment
            </Button>
        </Link>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Equipment Details</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
                    <div>
                        <h3 className="font-semibold text-muted-foreground">Information</h3>
                        <div className="mt-2 space-y-1">
                            <p><strong>ID:</strong> {eq.id}</p>
                            <p><strong>Type:</strong> {eq.type}</p>
                            <p><strong>Location:</strong> {eq.location}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-muted-foreground">VSD Control</h3>
                        {eq.vsdId ? <VSDInfo vsdId={eq.vsdId} /> : <p>No VSD associated.</p>}
                    </div>
                     <div>
                        <h3 className="font-semibold text-muted-foreground">Equipment Specifications</h3>
                         <div className="mt-2 space-y-1">
                            <p><strong>Pump Head:</strong> {eq.pumpHead > 0 ? `${eq.pumpHead}m` : 'N/A'}</p>
                            <p><strong>Flow Rate:</strong> {eq.flowRate > 0 ? `${eq.flowRate} m³/h`: 'N/A'}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-muted-foreground">Motor Specifications</h3>
                         <div className="mt-2 space-y-1">
                            <p><strong>Motor Model:</strong> {eq.motorModel || 'N/A'}</p>
                            <p><strong>Motor Power:</strong> {eq.motorPower > 0 ? `${eq.motorPower} kW`: 'N/A'}</p>
                            <p><strong>Motor Voltage:</strong> {eq.motorVoltage > 0 ? `${eq.motorVoltage}V` : 'N/A'}</p>
                            <p><strong>Motor S/N:</strong> {eq.motorSerialNumber || 'N/A'}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-muted-foreground">Protection</h3>
                         <div className="mt-2 space-y-1">
                            <p><strong>Breaker Model:</strong> {eq.breakerModel || 'N/A'}</p>
                            <p><strong>Breaker Amperage:</strong> {eq.breakerAmperage > 0 ? `${eq.breakerAmperage}A` : 'N/A'}</p>
                            <p><strong>Breaker Location:</strong> {eq.breakerLocation || 'N/A'}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-muted-foreground">Maintenance</h3>
                         <div className="mt-2 space-y-1">
                            <p><strong>Last:</strong> {eq.lastMaintenance}</p>
                            <p><strong>Next:</strong> {eq.nextMaintenance}</p>
                             <p><strong>Installation:</strong> {vsd?.installationDate || 'N/A'}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Breakdown History</CardTitle>
                        <CardDescription>Log of all reported issues for this equipment.</CardDescription>
                    </div>
                    <Link href="/breakdowns/new" passHref>
                        <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Log Breakdown</Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {breakdownsLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">Loading history...</TableCell>
                                </TableRow>
                            ) : eqBreakdowns && eqBreakdowns.length > 0 ? eqBreakdowns.map(b => (
                                <TableRow key={b.id}>
                                    <TableCell>{b.date}</TableCell>
                                    <TableCell>{b.description}</TableCell>
                                    <TableCell>
                                        <Badge variant={b.resolved ? 'default' : 'destructive'}>
                                            {b.resolved ? 'Resolved' : 'Pending'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">No breakdowns reported.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-8">
            {imageUrl && (
                <Card className="overflow-hidden">
                    <Image 
                        src={imageUrl}
                        alt={eq.name}
                        width={600}
                        height={400}
                        className="w-full h-auto object-cover"
                        data-ai-hint={imageHint}
                    />
                </Card>
            )}
             <Card>
                <CardHeader>
                    <CardTitle>Personnel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {eq.assignedToName ? (
                         <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">{eq.assignedToName}</p>
                                <p className="text-xs text-muted-foreground">Overall</p>
                            </div>
                        </div>
                    ) : null}
                    {vsd?.assignedToName ? (
                         <div className="flex items-center gap-3">
                            <Cpu className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">{vsd.assignedToName}</p>
                                <p className="text-xs text-muted-foreground">VSD Technician</p>
                            </div>
                        </div>
                    ) : null}
                    {eq.motorAssignedToName ? (
                         <div className="flex items-center gap-3">
                            <Wrench className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">{eq.motorAssignedToName}</p>
                                <p className="text-xs text-muted-foreground">Motor Technician</p>
                            </div>
                        </div>
                    ) : null}
                    {eq.protectionAssignedToName ? (
                         <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">{eq.protectionAssignedToName}</p>
                                <p className="text-xs text-muted-foreground">Protection Technician</p>
                            </div>
                        </div>
                    ) : null}
                    {!eq.assignedToName && !vsd?.assignedToName && !eq.motorAssignedToName && !eq.protectionAssignedToName && (
                        <p className="text-sm text-muted-foreground">No technicians assigned.</p>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Uptime</span>
                        <span className="font-bold">{uptimePercentage.toFixed(2)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Downtime</span>
                        <span className="font-bold">{(eq.totalDowntimeHours || 0).toFixed(2)} hours</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Power Consumption</span>
                        <span className="font-bold">{eq.powerConsumption} kWh</span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
