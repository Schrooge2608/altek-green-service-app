

'use client';

import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, User, Shield, Wrench, Cpu, Droplets, ArrowLeft, Cable, Cog, Power, Zap, Info, Fan, GitCommit, FilePlus } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Equipment, Breakdown, VSD, User as AppUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import React, { useMemo } from 'react';
import { Separator } from '@/components/ui/separator';
import { EditGeneralInfoForm } from '@/components/equipment/edit-general-info-form';
import { EditProtectionForm } from '@/components/equipment/edit-protection-form';
import { EditUpsForm } from '@/components/equipment/edit-ups-form';
import { EditVsdForm } from '@/components/equipment/edit-vsd-form';
import { EditMotorForm } from '@/components/equipment/edit-motor-form';
import { EditPumpForm } from '@/components/equipment/edit-pump-form';
import { EditImageForm } from '@/components/equipment/edit-image-form';
import { EditGearboxForm } from '@/components/equipment/edit-gearbox-form';
import { EditFanForm } from '@/components/equipment/edit-fan-form';
import { EditValveForm } from '@/components/equipment/edit-valve-form';
import { CreateUnscheduledScheduleDialog } from '@/components/equipment/create-unscheduled-schedule-dialog';

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
  const { user } = useUser();
  
  const eqRef = useMemoFirebase(() => (id ? doc(firestore, 'equipment', id) : null), [firestore, id]);
  const { data: eq, isLoading: eqLoading } = useDoc<Equipment>(eqRef);
  
  const vsdRef = useMemoFirebase(() => (eq ? doc(firestore, 'vsds', eq.vsdId) : null), [firestore, eq]);
  const { data: vsd, isLoading: vsdLoading } = useDoc<VSD>(vsdRef);

  const breakdownsQuery = useMemoFirebase(() => (id ? query(collection(firestore, 'breakdown_reports'), where('equipmentId', '==', id)) : null), [firestore, id]);
  const { data: eqBreakdowns, isLoading: breakdownsLoading } = useCollection<Breakdown>(breakdownsQuery);

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<AppUser>(userRoleRef);
  const canEdit = userData?.role && userData.role !== 'Client Manager';
  const isClientManager = userData?.role === 'Client Manager';

  const uptimePercentage = useMemo(() => {
    if (!eq) return 100;
    
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const totalHoursInMonth = daysInMonth * 24;

    const downtimeHours = eq.totalDowntimeHours || 0;
    const uptimeHours = totalHoursInMonth - downtimeHours;
    
    const percentage = Math.max(0, (uptimeHours / totalHoursInMonth) * 100);
    return percentage;
  }, [eq]);

  const backLink = useMemo(() => {
    if (!eq) return '/equipment';
    if (eq.plant === 'Mining' && eq.division) {
      return `/equipment/mining/${getDivisionSlug(eq.division)}`;
    }
     if (eq.plant === 'Smelter' && eq.division) {
      return `/equipment/smelter/${getDivisionSlug(eq.division)}`;
    }
    // Fallback for Smelter or equipment without a division
    return '/equipment'; 
  }, [eq]);

  const isSoftStarter = vsd?.driveType === 'Soft Starter';
  const controllerType = isSoftStarter ? 'Soft Starter' : 'VSD';

  if (eqLoading || vsdLoading) {
    return <EquipmentDetailSkeleton />;
  }

  if (!eq) {
    notFound();
    return null; // notFound() throws an error, but this is needed for type safety
  }
  
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
            <Link href={`/reports/contractors-daily-diary?equipmentName=${encodeURIComponent(eq.name)}`} passHref>
                <Button>
                    <FilePlus className="mr-2 h-4 w-4" />
                    Generate Daily Diary for Unscheduled work
                </Button>
            </Link>
            <CreateUnscheduledScheduleDialog equipment={eq} vsd={vsd} />
        </div>
      </header>

       <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <Info className="text-primary" /> 
                    <CardTitle>General Information</CardTitle>
                </div>
                 {canEdit && eq && (
                    <EditGeneralInfoForm equipment={eq} />
                )}
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
                <DetailRow label="ID" value={eq.id} />
                <DetailRow label="Location" value={eq.location} />
                <DetailRow label="Plant" value={`${eq.plant} ${eq.division ? `> ${eq.division}` : ''}`} />
                <DetailRow label="Assigned Technician" value={eq.assignedToName} />
            </CardContent>
        </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="text-primary" />
                        <CardTitle>Protection Details</CardTitle>
                    </div>
                    {canEdit && eq && (
                        <EditProtectionForm equipment={eq} />
                    )}
                </CardHeader>
                <CardContent className="text-sm space-y-6">
                    <CardDescription>Circuit breaker identification, ratings, and settings.</CardDescription>
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
        </div>
        <div className="space-y-8">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Power className="text-primary" />
                      <CardTitle>UPS/BTU Details</CardTitle>
                    </div>
                    {canEdit && eq && (
                        <EditUpsForm equipment={eq} />
                    )}
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <CardDescription>Battery backup unit information.</CardDescription>
                    <DetailRow label="UPS Model" value={eq.upsModel} />
                    <DetailRow label="UPS Serial Number" value={eq.upsSerialNumber} />
                    <DetailRow label="Battery Type" value={eq.batteryType} />
                    <DetailRow label="Installation Date" value={eq.upsInstallationDate} />
                    <DetailRow label="Last Battery Replacement" value={eq.lastBatteryReplacement} />
                    <DetailRow label="Assigned Technician" value={eq.upsAssignedToName} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Cpu className="text-primary" /> {controllerType} Information</CardTitle>
                    {canEdit && vsd && (
                        <EditVsdForm vsd={vsd} />
                    )}
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
                    <DetailRow label={`${controllerType} Model`} value={vsd?.model} />
                    <DetailRow label={`${controllerType} Manufacturer`} value={vsd?.manufacturer} />
                    <DetailRow label={`${controllerType} S/N`} value={vsd?.serialNumber} />
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
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Cog className="text-primary" /> Motor Information</CardTitle>
                    {canEdit && eq && (
                        <EditMotorForm equipment={eq} />
                    )}
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <CardDescription>Details for the motor driven by the VSD.</CardDescription>
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
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Breakdown History</CardTitle>
                        <CardDescription>Log of all reported issues for this equipment.</CardDescription>
                    </div>
                    {(canEdit || isClientManager) && (
                        <Link href={`/breakdowns/new?equipmentId=${eq.id}`} passHref>
                            <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Log Breakdown</Button>
                        </Link>
                    )}
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
            <Card>
                <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                    <CardDescription>Metrics for the current month.</CardDescription>
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
            
            {eq.pumpBrand && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2"><Droplets className="text-primary" /> Pump Information</CardTitle>
                        {canEdit && <EditPumpForm equipment={eq} />}
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
            )}
            
            {eq.gearboxModel && (
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2"><Cog className="text-primary" /> Gearbox Information</CardTitle>
                        {canEdit && <EditGearboxForm equipment={eq} />}
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <DetailRow label="Model" value={eq.gearboxModel} />
                        <DetailRow label="Brand" value={eq.gearboxBrand} />
                        <DetailRow label="Serial Number" value={eq.gearboxSerialNumber} />
                        <DetailRow label="Ratio" value={eq.gearboxRatio} />
                        <DetailRow label="Oil Type" value={eq.gearboxOilType} />
                        <DetailRow label="Oil Capacity (L)" value={eq.gearboxOilCapacityLiters} />
                        <DetailRow label="Assigned Technician" value={eq.gearboxAssignedToName} />
                    </CardContent>
                </Card>
            )}
            
            {eq.fanModel && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2"><Fan className="text-primary" /> Fan Information</CardTitle>
                        {canEdit && <EditFanForm equipment={eq} />}
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <DetailRow label="Type" value={eq.fanType} />
                        <DetailRow label="Brand" value={eq.fanBrand} />
                        <DetailRow label="Model" value={eq.fanModel} />
                        <DetailRow label="Serial Number" value={eq.fanSerialNumber} />
                        <DetailRow label="Airflow (CFM)" value={eq.fanAirflowCFM} />
                        <DetailRow label="Blade Diameter (mm)" value={eq.fanBladeDiameter} />
                        <DetailRow label="Assigned Technician" value={eq.fanAssignedToName} />
                    </CardContent>
                </Card>
            )}

            {eq.valveModel && (
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2"><GitCommit className="text-primary" /> Valve Information</CardTitle>
                        {canEdit && <EditValveForm equipment={eq} />}
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <DetailRow label="Type" value={eq.valveType} />
                        <DetailRow label="Brand" value={eq.valveBrand} />
                        <DetailRow label="Model" value={eq.valveModel} />
                        <DetailRow label="Serial Number" value={eq.valveSerialNumber} />
                        <DetailRow label="Size (Inches)" value={eq.valveSizeInches} />
                        <DetailRow label="Actuator Type" value={eq.valveActuatorType} />
                        <DetailRow label="Assigned Technician" value={eq.valveAssignedToName} />
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Equipment Image</CardTitle>
                     {canEdit && eq && (
                        <EditImageForm equipment={eq} />
                    )}
                </CardHeader>
                <CardContent>
                    <div className="overflow-hidden rounded-lg border aspect-video relative">
                        <Image 
                            src={eq.imageUrl || "/Pump.jpg"}
                            alt={eq.name}
                            fill
                            className="w-full h-auto object-cover"
                            data-ai-hint="industrial pump"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

    

    
