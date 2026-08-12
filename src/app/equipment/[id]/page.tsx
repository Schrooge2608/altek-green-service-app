'use client';

import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle, User, Shield, Wrench, Cpu, Droplets, ArrowLeft, Cable, Cog, Power, Zap, Info, Fan, GitCommit, FilePlus, Loader2, Trash2, TriangleAlert } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection, query, where, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Equipment, Breakdown, VSD, User as AppUser, DailyDiary } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
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
import { EditUpsBtuForm } from '@/components/equipment/edit-ups-btu-form';
import { CreateUnscheduledScheduleDialog } from '@/components/equipment/create-unscheduled-schedule-dialog';

function getDivisionSlug(divisionName?: string) {
    if (!divisionName) return '';
    return divisionName.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
}

function DetailRow({ label, value }: { label: string, value?: string | number | null }) {
    return (
        <div className="flex justify-between py-1.5 border-b border-dashed">
            <span className="text-muted-foreground text-xs">{label}:</span>
            <span className="font-medium text-right text-xs">{value || 'N/A'}</span>
        </div>
    );
}

function EquipmentDetailSkeleton() {
    return (
        <div className="flex flex-col gap-8 p-4 md:p-8">
            <header className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-9 w-1/2" />
                    <Skeleton className="h-4 w-1/3 mt-2" />
                </div>
                <Skeleton className="h-10 w-24" />
            </header>
             <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2 space-y-8">
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
  
  const vsdRef = useMemoFirebase(() => (eq && eq.vsdId ? doc(firestore, 'vsds', eq.vsdId) : null), [firestore, eq]);
  const { data: vsd, isLoading: vsdLoading } = useDoc<VSD>(vsdRef);

  const breakdownsQuery = useMemoFirebase(() => 
    (id ? query(collection(firestore, 'breakdown_reports'), where('equipmentId', '==', id)) : null), 
    [firestore, id]
  );
  const { data: eqBreakdownsRaw, isLoading: breakdownsLoading } = useCollection<Breakdown>(breakdownsQuery);

  const eqBreakdowns = useMemo(() => {
    if (!eqBreakdownsRaw) return [];
    return [...eqBreakdownsRaw].sort((a, b) => {
        const dateA = a.timeReported || a.date;
        const dateB = b.timeReported || b.date;
        return (dateB > dateA) ? 1 : -1;
    });
  }, [eqBreakdownsRaw]);

  const diariesQuery = useMemoFirebase(() => {
    if (!eq?.name) return null;
    const prefix = eq.mcc || eq.location || eq.division || '';
    const uniqueKey = prefix ? `${prefix} - ${eq.name}` : eq.name;
    const searchKeys = Array.from(new Set([uniqueKey, eq.name]));
    return query(collection(firestore, 'daily_diaries'), where('equipmentNames', 'array-contains-any', searchKeys));
  }, [firestore, eq]);
  const { data: eqDiariesRaw, isLoading: diariesLoading } = useCollection<DailyDiary>(diariesQuery);

  const eqDiaries = useMemo(() => {
    if (!eqDiariesRaw) return [];
    return [...eqDiariesRaw].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return (dateB > dateA) ? 1 : -1;
    });
  }, [eqDiariesRaw]);

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<AppUser>(userRoleRef);
  const canEdit = userData?.role && userData.role !== 'Client Manager';
  const isClientManager = userData?.role === 'Client Manager';
  const isManagerOrAdmin = userData?.role && (userData.role.includes('Admin') || userData.role.includes('Manager') || userData.role.includes('Supervisor'));


  const uptimePercentage = useMemo(() => {
    if (!eq) return 100;
    
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const totalHoursInMonth = daysInMonth * 24;

    const downtimeHours = eq.totalDowntimeHours || 0;
    const uptimeHours = totalHoursInMonth - downtimeHours;
    
    const percentage = (uptimeHours / totalHoursInMonth) * 100;
    return Math.min(100, Math.max(0, percentage));
  }, [eq]);

  const backLink = useMemo(() => {
    if (!eq) return '/equipment';
    
    // V2 Navigation based on MCC
    // MPA
    if (eq.mcc === 'MPA Dredger MCC' || eq.mcc === 'Dredge MCC') return '/mining/ponds/mpa/dredgers/mcc';
    if (eq.mcc === 'MPA Surge Bin MCC') return '/mining/ponds/mpa/surge-bin/mcc';
    if (eq.mcc === 'MPA Concentrator MCC') return '/mining/ponds/mpa/concentrator-plant/mcc';
    if (eq.mcc === 'MPA Tails Boosters MCC') return '/mining/ponds/mpa/tails-boosters/mcc';
    if (eq.mcc === 'MPA Cons Boosters MCC') return '/mining/ponds/mpa/cons-boosters/mcc';
    // MPC
    if (eq.mcc === 'MPC Dredger MCC') return '/mining/ponds/mpc/dredgers/mcc';
    if (eq.mcc === 'MPC Surge Bin MCC') return '/mining/ponds/mpc/surge-bin/mcc';
    if (eq.mcc === 'MPC Concentrator MCC C1') return '/mining/ponds/mpc/concentrator-plant/mcc-c1';
    if (eq.mcc === 'MPC Concentrator MCC C2') return '/mining/ponds/mpc/concentrator-plant/mcc-c2';
    if (eq.mcc === 'MPC Tails Boosters MCC') return '/mining/ponds/mpc/tails-boosters/mcc';
    if (eq.mcc === 'MPC Cons Boosters MCC') return '/mining/ponds/mpc/cons-boosters/mcc';
    if (eq.mcc === 'MPC Dry Mining') return '/mining/ponds/mpc/dry-mining';
    
    // MPE
    if (eq.mcc === 'MPE Dredger 1 MCC') return '/mining/ponds/mpe/dredge-1/mcc';
    if (eq.mcc === 'MPE Dredger 2 MCC') return '/mining/ponds/mpe/dredge-2/mcc';
    if (eq.mcc === 'MPE Surge Bin MCC') return '/mining/ponds/mpe/surge-bin/mcc';
    if (eq.mcc === 'MPE Concentrator MCC C1') return '/mining/ponds/mpe/concentrator-plant/mcc-c1';
    if (eq.mcc === 'MPE Concentrator MCC C2') return '/mining/ponds/mpe/concentrator-plant/mcc-c2';
    if (eq.mcc === 'MPE Tails Boosters MCC') return '/mining/ponds/mpe/tails-boosters/mcc';
    if (eq.mcc === 'MPE Cons Boosters MCC') return '/mining/ponds/mpe/cons-boosters/mcc';
    if (eq.mcc === 'MPE Dry Mining') return '/mining/ponds/mpe/dry-mining';    
    // MPD
    if (eq.mcc === 'MPD Dredger MCC') return '/mining/ponds/mpd/dredgers/mcc';
    if (eq.mcc === 'MPD Surge Bin MCC') return '/mining/ponds/mpd/surge-bin/mcc';
    if (eq.mcc === 'MPD Cons Plant D1 MCC') return '/mining/ponds/mpd/concentrator-plant/mcc';
    if (eq.mcc === 'MPD Tails Boosters MCC') return '/mining/ponds/mpd/tails-boosters/mcc';
    if (eq.mcc === 'MPD Cons Boosters MCC') return '/mining/ponds/mpd/cons-boosters/mcc';

    // MPE
    if (eq.mcc === 'MPE Cons E1 Drive Room') return '/mining/ponds/mpe/concentrator-plant/e1';
    if (eq.mcc === 'MPE Cons E2 Drive Room') return '/mining/ponds/mpe/concentrator-plant/e2';
    if (eq.mcc === 'MPE Dredge 1 MCC') return '/mining/ponds/mpe/dredge-1/mcc';
    if (eq.mcc === 'MPE Dredge 2 MCC') return '/mining/ponds/mpe/dredge-2/mcc';
    if (eq.mcc === 'MPE Surge Bin MCC') return '/mining/ponds/mpe/surge-bin/mcc';
    if (eq.mcc === 'MPE Cons Boosters MCC') return '/mining/ponds/mpe/cons-boosters/mcc';
    if (eq.mcc === 'MPE Tails Boosters MCC') return '/mining/ponds/mpe/tails-boosters/mcc';
    
    // Pump Stations
    if (eq.mcc === 'Nhlabane MCC') return '/mining/pump-stations/nhlabane';
    if (eq.mcc === 'Mposa MCC') return '/mining/pump-stations/mposa';
    if (eq.mcc === 'Monzi MCC') return '/mining/pump-stations/monzi';
    if (eq.mcc === 'Return Water Boosters MCC') return '/mining/pump-stations/return-water';
    
    // Smelter V2 Navigation
    if (eq.plant === 'Smelter' && eq.division === 'MSP') {
      if (eq.mcc === 'Top MCC') return '/smelter-v2/msp/ttp/top-mcc';
      if (eq.mcc === 'Bottom MCC') return '/smelter-v2/msp/ttp/bottom-mcc';
      if (eq.mcc === 'FPA/B MCC') return '/smelter-v2/msp/fpa-b';
      if (eq.mcc === 'FPC MCC') return '/smelter-v2/msp/fpc';
      if (eq.mcc === 'CALCIUM REJ MCC') return '/smelter-v2/msp/calcium-rejection';
      if (eq.mcc === 'RWPH MCC') return '/smelter-v2/msp/rwph';
      if (eq.mcc === 'CONE SETTLER MCC') return '/smelter-v2/msp/cone-settler';
      if (eq.mcc === 'DM 1 - WET MCC') return '/smelter-v2/msp/dry-mill-1/wet-mcc';
      if (eq.mcc === 'DM 1 - DRY MCC') return '/smelter-v2/msp/dry-mill-1/dry-mcc';
      if (eq.mcc === 'DM2 - ZIRCON MCC') return '/smelter-v2/msp/dry-mill-2/zircon-mcc';
      if (eq.mcc === 'DM2 - SERVICES MCC') return '/smelter-v2/msp/dry-mill-2/services-mcc';
      if (eq.mcc === 'DM2 - RUTILE MCC') return '/smelter-v2/msp/dry-mill-2/rutile-mcc';
      if (eq.mcc === 'LIME SHED') return '/smelter-v2/msp/nztp/lime-shed';
      if (eq.mcc === 'NZTP CALCINER MCC') return '/smelter-v2/msp/nztp/calciner-mcc';
      if (eq.mcc === 'NZTP DSA ROOM') return '/smelter-v2/msp/nztp/dsa-room';
      if (eq.mcc === 'PILOT PLANT MCC') return '/smelter-v2/msp/pilot-plant';
      
      return '/smelter-v2/msp';
    }

    // Roaster Navigation
    if (eq.plant === 'Smelter' && eq.division === 'Roaster') {
      if (eq.mcc === 'Roaster MCC 1') return '/smelter-v2/roaster/mcc1';
      if (eq.mcc === 'Roaster MCC 2') return '/smelter-v2/roaster/mcc2';
      if (eq.mcc === 'Roaster MCC 3') return '/smelter-v2/roaster/mcc3';
      if (eq.mcc === 'Roaster MCC 4') return '/smelter-v2/roaster/mcc4';
      if (eq.mcc === 'Roaster MCC 5') return '/smelter-v2/roaster/mcc5';
      
      return '/smelter-v2/roaster';
    }

    // Char Plant Navigation
    if (eq.plant === 'Smelter' && eq.division === 'Char Plant') {
      if (eq.mcc === 'Charplant Top MCC / E4') return '/smelter-v2/char-plant/top-mcc';
      if (eq.mcc === 'Charplant Bottom MCC / E10') return '/smelter-v2/char-plant/bottom-mcc';
      
      return '/smelter-v2/char-plant';
    }

    // Smelter Core Navigation
    if (eq.plant === 'Smelter' && eq.division?.startsWith('Smelter - ')) {
      if (eq.division === 'Smelter - SF1') return '/smelter-v2/smelter/area/sf1';
      if (eq.division === 'Smelter - SF2') return '/smelter-v2/smelter/area/sf2';
      if (eq.division === 'Smelter - SF3') return '/smelter-v2/smelter/area/sf3';
      if (eq.division === 'Smelter - SF4') return '/smelter-v2/smelter/area/sf4';
      if (eq.division === 'Smelter - Common') return '/smelter-v2/smelter/area/common';
      if (eq.division === 'Smelter - Clay Gun') return '/smelter-v2/smelter/area/clay-gun';
      
      return '/smelter-v2/smelter/area';
    }

    if (eq.plant === 'Smelter' && eq.division === 'Smelter Elevator') {
      return '/smelter-v2/smelter/area/elevator';
    }

    // Iron Injection Navigation
    if (eq.plant === 'Smelter' && eq.division === 'Iron Injection') {
      if (eq.mcc === 'West Crane MCC') return '/smelter-v2/iron-injection/west-crane';
      if (eq.mcc === 'East Crane MCC') return '/smelter-v2/iron-injection/east-crane';
      if (eq.mcc === 'Control room Sub station') return '/smelter-v2/iron-injection/control-room';
      if (eq.mcc === 'PCM 1 MCC' || eq.mcc === 'PCM 2 MCC') return '/smelter-v2/iron-injection/pcm';
      
      return '/smelter-v2/iron-injection';
    }

    // Stripping Crane Navigation
    if (eq.plant === 'Smelter' && eq.division === 'Stripping Cranes') {
      if (eq.mcc === 'Stripping Crane 1 MCC') return '/smelter-v2/stripping-crane/crane-1';
      if (eq.mcc === 'Stripping Crane 2 MCC') return '/smelter-v2/stripping-crane/crane-2';
      return '/smelter-v2/stripping-crane';
    }

    // Slag Plant Navigation
    if (eq.plant === 'Smelter' && eq.division === 'Slag Plant') {
      if (eq.mcc === 'F.B.C. MCC') return '/smelter-v2/slag-plant/fbc';
      if (eq.mcc === 'Regrind MCC') return '/smelter-v2/slag-plant/regrind';
      if (eq.mcc === 'Slag MCC') return '/smelter-v2/slag-plant/slag';
      if (eq.mcc === 'Hadfield Crusher MCC') return '/smelter-v2/slag-plant/hadfield';
      if (eq.mcc === 'Slag Cooling Water MCC') return '/smelter-v2/slag-plant/cooling-water';
      return '/smelter-v2/slag-plant';
    }

    // North Screen Navigation
    if (eq.plant === 'Smelter' && eq.division === 'North Screen') {
      return '/smelter-v2/north-screen';
    }

    // V1 Legacy Navigation
    if (eq.plant === 'Mining' && eq.division) {
      return `/equipment/mining/${getDivisionSlug(eq.division)}`;
    }
    if (eq.plant === 'Smelter' && eq.division) {
      return `/equipment/smelter/${getDivisionSlug(eq.division)}`;
    }
    return '/equipment'; 
  }, [eq]);

  const isSoftStarter = vsd?.driveType === 'Soft Starter';
  const controllerType = isSoftStarter ? 'Soft Starter' : 'VSD';

  const applianceName = useMemo(() => {
    if (!eq?.name) return 'MOTOR';
    const nameLower = eq.name.toLowerCase();
    if (nameLower.includes('pump')) return 'PUMP';
    if (nameLower.includes('winch')) return 'WINCH';
    if (nameLower.includes('cutter')) return 'CUTTER WHEEL';
    if (nameLower.includes('spud')) return 'SPUD CARRIAGE';
    return 'MOTOR';
  }, [eq?.name]);

  const isBoosterPump = eq?.division === 'Tails Boosters' || eq?.division === 'Cons Boosters' || eq?.division === 'Return Water Booster Station';
  const hasLocalUps = !!eq?.upsType;

  const addLocalUps = async () => {
    if (!eqRef) return;
    await updateDoc(eqRef, {
        upsType: 'Unspecified',
        upsBrand: 'Unspecified',
        batteryType: 'Unspecified',
        batteryQuantity: 0,
        batteryExpiryDate: '',
        lastBatteryReplacement: '',
        upsSerialNumber: ''
    });
  };

  const removeLocalUps = async () => {
    if (!eqRef) return;
    await updateDoc(eqRef, {
        upsType: '',
        upsBrand: '',
        batteryType: '',
        batteryQuantity: null,
        batteryExpiryDate: '',
        lastBatteryReplacement: '',
        upsSerialNumber: ''
    });
  };

  if (eqLoading || vsdLoading || breakdownsLoading) {
    return <EquipmentDetailSkeleton />;
  }

  if (!eq) {
    notFound();
    return null;
  }
  
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{eq.name}</h1>
            <p className="text-muted-foreground text-sm">Detailed view of equipment ID: {eq.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Link href={backLink} passHref>
                <Button variant="outline" size="sm">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
            </Link>
            <Link href={`/reports/contractors-daily-diary?equipmentName=${encodeURIComponent(eq.name)}`} passHref>
                <Button size="sm">
                    <FilePlus className="mr-2 h-4 w-4" />
                    Daily Diary
                </Button>
            </Link>
            {isManagerOrAdmin && <CreateUnscheduledScheduleDialog equipment={eq} vsd={vsd} />}
        </div>
      </header>

       <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" /> 
                    <CardTitle className="text-sm uppercase tracking-wider font-bold">General Information</CardTitle>
                </div>
                 {canEdit && eq && (
                    <EditGeneralInfoForm equipment={eq} />
                )}
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-x-12 gap-y-2 p-4 text-sm">
                <DetailRow label="ID" value={eq.id} />
                <DetailRow label="Location" value={eq.location} />
                <DetailRow label="Plant" value={`${eq.plant} ${eq.division ? `> ${eq.division}` : ''}`} />
                <DetailRow label="Assigned Technician" value={eq.assignedToName} />
            </CardContent>
        </Card>

      <div className="grid gap-8 md:grid-cols-3">
        {eq.name?.toUpperCase().includes('UPS') || eq.name?.toUpperCase().includes('BTU') ? (
          <>
              <div className="md:col-span-2 space-y-8">
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-slate-50/50">
                          <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary" />
                              <CardTitle className="text-sm uppercase tracking-wider font-bold">UPS / BTU Details</CardTitle>
                          </div>
                          {canEdit && <EditUpsBtuForm equipment={eq} />}
                      </CardHeader>
                      <CardContent className="grid md:grid-cols-2 gap-4 p-4 text-sm">
                          <DetailRow label="Type" value={eq.upsType} />
                          <DetailRow label="Battery Type" value={eq.batteryType} />
                          <DetailRow label="Battery Quantity" value={eq.batteryQuantity} />
                          <DetailRow label="Date of Expiry (Battery)" value={eq.batteryExpiryDate} />
                          <DetailRow label="Date Replaced (Battery)" value={eq.lastBatteryReplacement} />
                          <DetailRow label="Serial Number" value={eq.upsSerialNumber} />
                      </CardContent>
                  </Card>
              </div>
              <div className="space-y-8">
                  <Card className="bg-primary/5 border-primary/20">
                      <CardHeader className="pb-2">
                          <CardTitle className="text-sm uppercase tracking-widest font-bold text-primary">Performance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                          <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                              <span className="text-muted-foreground font-medium">Uptime</span>
                              <span className="font-bold text-lg">{uptimePercentage.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                              <span className="text-muted-foreground font-medium">Monthly Downtime</span>
                              <span className="font-bold">{(eq.totalDowntimeHours || 0).toFixed(1)} hrs</span>
                          </div>
                          <div className="flex items-center justify-between">
                              <span className="text-muted-foreground font-medium">Energy Consumption</span>
                              <span className="font-bold">{(eq.powerConsumption || 0).toLocaleString()} <span className="text-[10px] font-normal">kWh</span></span>
                          </div>
                      </CardContent>
                  </Card>
                  
                  <Card className="overflow-hidden">
                      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-slate-50/50">
                          <CardTitle className="text-xs uppercase font-bold text-muted-foreground">Gallery</CardTitle>
                            {canEdit && eq && (
                              <EditImageForm equipment={eq} />
                          )}
                      </CardHeader>
                      <CardContent className="p-0">
                          <div className="aspect-video relative">
                              <Image 
                                  src={eq.imageUrl || "/Pump.jpg"}
                                  alt={eq.name}
                                  fill
                                  className="w-full h-auto object-cover"
                                  data-ai-hint="industrial equipment"
                              />
                          </div>
                      </CardContent>
                  </Card>
              </div>
          </>
      ) : (
        <>
          <div className="space-y-8">
               {isBoosterPump && (
                  hasLocalUps ? (
                      <Card className="border-primary/20 bg-primary/5">
                          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-primary/10 bg-slate-50/50">
                              <div className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-primary" />
                                  <CardTitle className="text-sm uppercase tracking-wider font-bold text-primary">Local UPS / BTU Details</CardTitle>
                              </div>
                              <div className="flex items-center gap-1">
                                  {canEdit && <EditUpsBtuForm equipment={eq} />}
                                  {canEdit && (
                                     <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={removeLocalUps}>
                                        <Trash2 className="h-4 w-4" />
                                     </Button>
                                  )}
                              </div>
                          </CardHeader>
                          <CardContent className="grid md:grid-cols-2 gap-4 p-4 text-sm">
                              <DetailRow label="Type" value={eq.upsType} />
                              <DetailRow label="Brand" value={eq.upsBrand} />
                              <DetailRow label="Battery Type" value={eq.batteryType} />
                              <DetailRow label="Battery Quantity" value={eq.batteryQuantity} />
                              <DetailRow label="Date of Expiry (Battery)" value={eq.batteryExpiryDate} />
                              <DetailRow label="Date Replaced (Battery)" value={eq.lastBatteryReplacement} />
                              <DetailRow label="Serial Number" value={eq.upsSerialNumber} />
                          </CardContent>
                      </Card>
                  ) : (
                      canEdit && (
                          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg border-primary/20 bg-primary/5">
                              <p className="text-sm text-muted-foreground mb-4">This booster pump does not have a registered local UPS.</p>
                              <Button onClick={addLocalUps} variant="outline" className="text-primary border-primary hover:bg-primary/10">
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Add Local UPS / BTU
                              </Button>
                          </div>
                      )
                  )
               )}

               <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-slate-50/50">
                      <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm uppercase tracking-wider font-bold">Protection</CardTitle>
                      </div>
                      {canEdit && eq && (
                          <EditProtectionForm equipment={eq} />
                      )}
                  </CardHeader>
                  <CardContent className="text-sm space-y-6 pt-4">
                      <div>
                          <h4 className="font-bold text-[10px] uppercase text-muted-foreground mb-3 tracking-widest">Identification</h4>
                          <DetailRow label="Asset Number / Tag ID" value={eq.breakerAssetNumber} />
                          <DetailRow label="Location / Hierarchy" value={eq.breakerLocationHierarchy} />
                          <DetailRow label="Type" value={eq.breakerType} />
                      </div>
                      <div>
                          <h4 className="font-bold text-[10px] uppercase text-muted-foreground mb-3 tracking-widest">Ratings</h4>
                          <DetailRow label="Rated Voltage (Ue)" value={eq.breakerRatedVoltage ? `${eq.breakerRatedVoltage}V` : null} />
                          <DetailRow label="Frame Size (In)" value={eq.breakerFrameSize ? `${eq.breakerFrameSize}A` : null} />
                          <DetailRow label="Breaking Capacity" value={eq.breakerBreakingCapacity ? `${eq.breakerBreakingCapacity}kA` : null} />
                      </div>
                      <div>
                          <h4 className="font-bold text-[10px] uppercase text-muted-foreground mb-3 tracking-widest">Settings</h4>
                          <DetailRow label="Trip Unit Type" value={eq.breakerTripUnitType} />
                          <DetailRow label="Overload (Ir)" value={eq.breakerOverloadSetting ? `${eq.breakerOverloadSetting}A` : null} />
                          <DetailRow label="Short-Circuit" value={eq.breakerShortCircuitSetting} />
                          <DetailRow label="Ground Fault" value={eq.breakerGroundFaultSetting} />
                      </div>
                  </CardContent>
              </Card>
          </div>
          <div className="space-y-8">
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-slate-50/50">
                      <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm uppercase tracking-wider font-bold">{controllerType}</CardTitle>
                      </div>
                      {canEdit && vsd && (
                          <EditVsdForm vsd={vsd} />
                      )}
                  </CardHeader>
                  <CardContent className="grid gap-2 p-4 text-sm">
                      <DetailRow label="Model" value={vsd?.model} />
                      <DetailRow label="Manufacturer" value={vsd?.manufacturer} />
                      <DetailRow label="Serial Number" value={vsd?.serialNumber} />
                      <DetailRow label="DSU Left Serial No." value={vsd?.dsuLeftSerialNumber} />
                      <DetailRow label="DSU Right Serial No." value={vsd?.dsuRightSerialNumber} />
                      <DetailRow label="Inverter Left Serial No." value={vsd?.inverterLeftSerialNumber} />
                      <DetailRow label="Inverter Right Serial No." value={vsd?.inverterRightSerialNumber} />
                      <div className="flex justify-between py-1.5 border-b border-dashed">
                          <span className="text-muted-foreground text-xs">Status:</span>
                          <Badge variant={vsd?.status === 'active' ? 'default' : (vsd?.status === 'maintenance' ? 'secondary' : 'destructive')} className="text-[10px] py-0 h-5">{vsd?.status || 'Unknown'}</Badge>
                      </div>
                  </CardContent>
              </Card>
              <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-slate-50/50">
                      <div className="flex items-center gap-2">
                          <Cog className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm uppercase tracking-wider font-bold">{applianceName}</CardTitle>
                      </div>
                      {canEdit && eq && (
                          <EditMotorForm equipment={eq} />
                      )}
                  </CardHeader>
                  <CardContent className="text-sm space-y-2 pt-4">
                      <DetailRow label="Motor Model" value={eq.motorModel} />
                      <DetailRow label="Motor Power" value={eq.motorPower ? `${eq.motorPower} kW` : null} />
                      <DetailRow label="Motor Voltage" value={eq.motorVoltage ? `${eq.motorVoltage} V` : null} />
                      <DetailRow label="Serial Number" value={eq.motorSerialNumber} />
                  </CardContent>
              </Card>
          </div>
  
          <div className="space-y-8">
              <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-2">
                      <CardTitle className="text-sm uppercase tracking-widest font-bold text-primary">Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                      <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                          <span className="text-muted-foreground font-medium">Uptime</span>
                          <span className="font-bold text-lg">{uptimePercentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                          <span className="text-muted-foreground font-medium">Monthly Downtime</span>
                          <span className="font-bold">{(eq.totalDowntimeHours || 0).toFixed(1)} hrs</span>
                      </div>
                      <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">Energy Consumption</span>
                          <span className="font-bold">{(eq.powerConsumption || 0).toLocaleString()} <span className="text-[10px] font-normal">kWh</span></span>
                      </div>
                  </CardContent>
              </Card>
              
              {eq.pumpBrand && (
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-slate-50/50">
                          <div className="flex items-center gap-2">
                              <Droplets className="h-4 w-4 text-primary" />
                              <CardTitle className="text-sm uppercase tracking-wider font-bold">Pump</CardTitle>
                          </div>
                          {canEdit && <EditPumpForm equipment={eq} />}
                      </CardHeader>
                      <CardContent className="grid gap-2 p-4 text-sm">
                          <DetailRow label="Brand" value={eq.pumpBrand} />
                          <DetailRow label="Serial Number" value={eq.pumpSerialNumber} />
                          <DetailRow label="Flow Rate" value={eq.flowRate ? `${eq.flowRate} m³/h` : null} />
                          <DetailRow label="Commissioned" value={eq.pumpCommissionDate} />
                      </CardContent>
                  </Card>
              )}
              
              {eq.gearboxModel && (
                   <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-slate-50/50">
                          <div className="flex items-center gap-2">
                              <Cog className="h-4 w-4 text-primary" />
                              <CardTitle className="text-sm uppercase tracking-wider font-bold">Gearbox</CardTitle>
                          </div>
                          {canEdit && <EditGearboxForm equipment={eq} />}
                      </CardHeader>
                      <CardContent className="grid gap-2 p-4 text-sm">
                          <DetailRow label="Model" value={eq.gearboxModel} />
                          <DetailRow label="Ratio" value={eq.gearboxRatio} />
                          <DetailRow label="Oil Type" value={eq.gearboxOilType} />
                      </CardContent>
                  </Card>
              )}
  
              <Card className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 border-b bg-slate-50/50">
                      <CardTitle className="text-xs uppercase font-bold text-muted-foreground">Gallery</CardTitle>
                       {canEdit && eq && (
                          <EditImageForm equipment={eq} />
                      )}
                  </CardHeader>
                  <CardContent className="p-0">
                      <div className="aspect-video relative">
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
        </>
      )}
      <div className="md:col-span-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50">
                    <div>
                        <CardTitle className="text-base font-bold uppercase tracking-tight">Breakdown History</CardTitle>
                        <CardDescription className="text-xs">Audit log of reported incidents.</CardDescription>
                    </div>
                    {(canEdit || isClientManager) && (
                        <Link href={`/reports/field-service-report/new?equipmentId=${eq.id}`} passHref>
                          <Button variant="outline" className="flex-1 w-full sm:w-auto h-auto min-h-[48px] justify-start text-left whitespace-normal border-amber-200 hover:bg-amber-50 hover:text-amber-900 group">
                            <TriangleAlert className="mr-2 h-5 w-5 text-amber-500 group-hover:text-amber-600 flex-shrink-0" />
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm">Report a Breakdown</span>
                              <span className="text-xs text-muted-foreground font-normal">Log an issue using a Field Service Report</span>
                            </div>
                          </Button>
                        </Link>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Description</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {breakdownsLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">
                                        <Loader2 className="animate-spin h-4 w-4 mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : eqBreakdowns && eqBreakdowns.length > 0 ? eqBreakdowns.map(b => {
                                const isFinished = b.resolved || b.status === 'Closed' || b.isLocked;
                                return (
                                <TableRow key={b.id} className="text-xs">
                                    <TableCell className="font-medium whitespace-nowrap">{b.date}</TableCell>
                                    <TableCell className="max-w-md truncate">{b.description}</TableCell>
                                    <TableCell>
                                        <Badge variant={isFinished ? 'default' : 'destructive'} className="text-[9px] px-1.5 py-0">
                                            {isFinished ? 'Resolved' : 'Active'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )}) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24 text-muted-foreground italic text-xs">No incidents recorded.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card className="mt-8">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50">
                    <div>
                        <CardTitle className="text-base font-bold uppercase tracking-tight">Daily Work History</CardTitle>
                        <CardDescription className="text-xs">Log of reported daily work from diaries.</CardDescription>
                    </div>
                    {(canEdit || isClientManager) && (
                        <Link href={`/reports/contractors-daily-diary`} passHref>
                            <Button variant="outline" size="sm"><FilePlus className="mr-2 h-4 w-4" /> Log Daily Work</Button>
                        </Link>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Scope of Work</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Time</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-center">Hrs</TableHead>
                                <TableHead className="w-16"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {diariesLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        <Loader2 className="animate-spin h-4 w-4 mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : (() => {
                                const prefix = eq?.mcc || eq?.location || eq?.division || '';
                                const uniqueKey = prefix ? `${prefix} - ${eq?.name}` : eq?.name;
                                const rows = eqDiaries && eqDiaries.length > 0 ? eqDiaries.flatMap(d => {
                                    const matchingWorks = d.works?.filter(w => w.area === eq?.name || w.area === uniqueKey) || [];
                                    return matchingWorks.map((work, idx) => (
                                        <TableRow key={`${d.id}-${idx}`} className="text-xs">
                                            <TableCell className="font-medium whitespace-nowrap">{typeof d.date === 'string' ? d.date : format(d.date as Date, 'yyyy-MM-dd')}</TableCell>
                                            <TableCell className="max-w-md truncate">{work.scope || 'N/A'}</TableCell>
                                            <TableCell className="whitespace-nowrap">{work.timeStart || '--:--'} - {work.timeEnd || '--:--'}</TableCell>
                                            <TableCell className="whitespace-nowrap font-bold text-center">{work.hrs || 0}</TableCell>
                                            <TableCell>
                                                <Link href={`/reports/contractors-daily-diary?id=${d.id}`} passHref>
                                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] hover:underline">View</Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ));
                                }) : [];
                                
                                if (rows.length > 0) return rows;
                                return (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground italic text-xs">No daily work recorded.</TableCell>
                                    </TableRow>
                                );
                            })()}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
