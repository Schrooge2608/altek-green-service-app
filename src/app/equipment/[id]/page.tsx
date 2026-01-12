

'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, User, Shield, Wrench, Cpu, Droplets, ArrowLeft, Cable, Cog, Power, Zap, Info } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Equipment, Breakdown, VSD } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import React, { useMemo } from 'react';
import { Separator } from '@/components/ui/separator';

const imageMap: { [key: string]: string } = {
    Pump: "pump-1",
    Fan: "fan-1",
    Compressor: "compressor-1",
    Winch: "winch-1"
};

function getDivisionSlug(divisionName?: string) {
    if (!divisionName) return '';
    return divisionName.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
}

function DetailRow({ label, value }: { label: string, value?: string | number | null }) {
    return (
        <div className="flex justify-between py-1.5 border-b border-dashed">
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-medium text-right">{value || 'N/A'}</span>
        </div>
    );
}

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

  }, [vsd, eq]);

  const backLink = useMemo(() => {
    if (!eq) return '/equipment';
    if (eq.plant === 'Mining' && eq.division) {
      return `/equipment/mining/${getDivisionSlug(eq.division)}`;
    }
    // Fallback for Smelter or equipment without a division
    return '/equipment'; 
  }, [eq]);

  if (eqLoading || vsdLoading) {
    return <EquipmentDetailSkeleton />;
  }

  if (!eq) {
    notFound();
    return null; // notFound() throws an error, but this is needed for type safety
  }
  
  const defaultPlaceholder = PlaceHolderImages.find(p => p.id === 'dashboard-hero');
  const imageUrl = eq.imageUrl || defaultPlaceholder?.imageUrl;
  const imageHint = defaultPlaceholder?.imageHint || 'industrial equipment';
  
  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">{eq.name}</h1>
            <p className="text-muted-foreground">Detailed view of equipment ID: {eq.id}</p>
        </div>
        <div className="flex items-center gap-2">
            <Link href={backLink} passHref>
                <Button variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
            </Link>
            <Link href={`/equipment/${id}/edit`} passHref>
                <Button>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Equipment
                </Button>
            </Link>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Info className="text-primary" /> General Information</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
                    <DetailRow label="ID" value={eq.id} />
                    <DetailRow label="Location" value={eq.location} />
                    <DetailRow label="Plant" value={`${eq.plant} ${eq.division ? `> ${eq.division}` : ''}`} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Shield className="text-primary" /> Protection Details</CardTitle>
                    <CardDescription>Circuit breaker identification, ratings, and settings.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-6">
                    <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground">Identification & Location</h4>
                        <DetailRow label="Asset Number / Tag ID" value={eq.breakerAssetNumber} />
                        <DetailRow label="Location / Hierarchy" value={eq.breakerLocationHierarchy} />
                        <DetailRow label="Service / Description" value={eq.breakerServiceDescription} />
                        <DetailRow label="Manufacturer" value={eq.breakerManufacturer} />
                        <DetailRow label="Model Range" value={eq.breakerModelRange} />
                        <DetailRow label="Type" value={eq.breakerType} />
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground">Electrical Ratings (Hard Limits)</h4>
                        <DetailRow label="Rated Voltage (Ue)" value={eq.breakerRatedVoltage ? `${eq.breakerRatedVoltage}V` : null} />
                        <DetailRow label="Frame Size (In)" value={eq.breakerFrameSize ? `${eq.breakerFrameSize}A` : null} />
                        <DetailRow label="Breaking Capacity (Icu)" value={eq.breakerBreakingCapacity ? `${eq.breakerBreakingCapacity}kA` : null} />
                        <DetailRow label="Number of Poles" value={eq.breakerNumberOfPoles} />
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground">Protection Settings (Soft Limits)</h4>
                        <DetailRow label="Trip Unit Type" value={eq.breakerTripUnitType} />
                        <DetailRow label="Overload (Ir)" value={eq.breakerOverloadSetting ? `${eq.breakerOverloadSetting}A` : null} />
                        <DetailRow label="Short-Circuit (Isd)" value={eq.breakerShortCircuitSetting} />
                        <DetailRow label="Instantaneous (Ii)" value={eq.breakerInstantaneousSetting} />
                        <DetailRow label="Ground Fault (Ig)" value={eq.breakerGroundFaultSetting} />
                    </div>
                    <Separator />
                    <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground">Accessories & Control</h4>
                        <DetailRow label="Operation Mechanism" value={eq.breakerOperationMechanism} />
                        <DetailRow label="Motor Voltage" value={eq.breakerMotorVoltage ? `${eq.breakerMotorVoltage}V` : null} />
                        <DetailRow label="Shunt Trip Voltage" value={eq.breakerShuntTripVoltage ? `${eq.breakerShuntTripVoltage}V` : null} />
                        <DetailRow label="Undervoltage Release" value={eq.breakerUndervoltageRelease} />
                        <DetailRow label="Auxiliary Contacts" value={eq.breakerAuxiliaryContacts} />
                    </div>
                     <Separator />
                     <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground">Maintenance & Assignment</h4>
                        <DetailRow label="Installation Date" value={eq.protectionInstallationDate} />
                        <DetailRow label="Assigned Technician" value={eq.protectionAssignedToName} />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Power className="text-primary" /> UPS/BTU Details</CardTitle>
                    <CardDescription>Battery backup unit information.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <DetailRow label="UPS Model" value={eq.upsModel} />
                    <DetailRow label="UPS Serial Number" value={eq.upsSerialNumber} />
                    <DetailRow label="Battery Type" value={eq.batteryType} />
                    <DetailRow label="Installation Date" value={eq.upsInstallationDate} />
                    <DetailRow label="Last Battery Replacement" value={eq.lastBatteryReplacement} />
                    <DetailRow label="Assigned Technician" value={eq.upsAssignedToName} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Cpu className="text-primary" /> VSD Information</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
                    <DetailRow label="VSD Model" value={vsd?.model} />
                    <DetailRow label="VSD S/N" value={vsd?.serialNumber} />
                    <DetailRow label="Installation Date" value={vsd?.installationDate} />
                    <DetailRow label="Assigned Technician" value={vsd?.assignedToName} />
                    <div className="flex justify-between py-1.5 border-b border-dashed col-span-2 md:col-span-1">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="font-medium text-right">
                           <Badge variant={vsd?.status === 'active' ? 'default' : (vsd?.status === 'maintenance' ? 'secondary' : 'destructive')}>{vsd?.status || 'Unknown'}</Badge>
                        </span>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Cog className="text-primary" /> Motor Information</CardTitle>
                    <CardDescription>Details for the motor driven by the VSD.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <DetailRow label="Motor Model" value={eq.motorModel} />
                    <DetailRow label="Motor Power" value={eq.motorPower ? `${eq.motorPower} kW` : null} />
                    <DetailRow label="Motor Voltage" value={eq.motorVoltage ? `${eq.motorVoltage} V` : null} />
                    <DetailRow label="Motor Serial Number" value={eq.motorSerialNumber} />
                    <DetailRow label="Motor Frame Type" value={eq.motorFrameType} />
                    <DetailRow label="Installation Date" value={eq.motorInstallationDate} />
                    <DetailRow label="Assigned Technician" value={eq.motorAssignedToName} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Droplets className="text-primary" /> Pump Information</CardTitle>
                    <CardDescription>Details for the pump connected to the motor.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <DetailRow label="Pump Type" value={eq.pumpType} />
                    <DetailRow label="Pump Brand" value={eq.pumpBrand} />
                    <DetailRow label="Pump S/N" value={eq.pumpSerialNumber} />
                    <DetailRow label="Manufacturer" value={eq.pumpManufacturer} />
                    <Separator className="md:col-span-2 my-2"/>
                    <DetailRow label="Pump Head" value={eq.pumpHead ? `${eq.pumpHead} m` : null} />
                    <DetailRow label="Flow Rate" value={eq.flowRate ? `${eq.flowRate} m³/h` : null} />
                    <DetailRow label="Impeller Diameter" value={eq.pumpImpellerDiameter ? `${eq.pumpImpellerDiameter} mm` : null} />
                    <DetailRow label="Date Commissioned" value={eq.pumpCommissionDate} />
                    <Separator className="md:col-span-2 my-2"/>
                    <DetailRow label="Flange Size In" value={eq.pumpFlangeSizeIn ? `${eq.pumpFlangeSizeIn} mm` : null} />
                    <DetailRow label="Flange Size Outlet" value={eq.pumpFlangeSizeOutlet ? `${eq.pumpFlangeSizeOutlet} mm` : null} />
                    <DetailRow label="Frame Size" value={eq.pumpFrameSize} />
                    <DetailRow label="Frame Type" value={eq.pumpFrameType} />
                    <Separator className="md:col-span-2 my-2"/>
                    <DetailRow label="Assigned Technician" value={eq.pumpAssignedToName} />
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
