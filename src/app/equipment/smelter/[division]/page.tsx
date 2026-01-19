
'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Equipment, User } from '@/lib/types';
import { PlusCircle, LogIn, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AssignTechnicianDropdown } from '@/components/equipment/assign-technician-dropdown';

const validDivisions: Record<string, string> = {
    'msp': 'MSP',
    'roaster': 'Roaster',
    'char-plant': 'Char Plant',
    'smelter': 'Smelter',
    'iron-injection': 'Iron Injection',
    'stripping-crane': 'Stripping Crane',
    'slag-plant': 'Slag Plant',
    'north-screen': 'North Screen',
    'ups-btus': "UPS/BTU's",
}

function AuthenticatedSmelterDivisionPage() {
  const params = useParams();
  const divisionSlug = Array.isArray(params.division) ? params.division[0] : params.division;
  const { user } = useUser();
  const { toast } = useToast();
  
  const memoizedDivisionName = useMemo(() => {
    if (!divisionSlug || !validDivisions[divisionSlug]) {
        notFound();
    }
    return validDivisions[divisionSlug];
  }, [divisionSlug]);

  const firestore = useFirestore();
  
  const equipmentQuery = useMemoFirebase(() => {
    if (!memoizedDivisionName || !user) return null;
    return query(
        collection(firestore, 'equipment'), 
        where('plant', '==', 'Smelter'),
        where('division', '==', memoizedDivisionName)
    );
  }, [firestore, memoizedDivisionName, user]);

  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const canDelete = userData?.role && ['Admin', 'Superadmin'].includes(userData.role);
  const isClientManager = userData?.role === 'Client Manager';

  const isLoading = equipmentLoading || usersLoading;
  
  const equipmentByLocation = useMemo(() => {
    if (!equipment) return {};
    return equipment.reduce((acc, eq) => {
        const location = eq.location || 'Uncategorized';
        if (!acc[location]) {
            acc[location] = [];
        }
        acc[location].push(eq);
        return acc;
    }, {} as Record<string, Equipment[]>);
  }, [equipment]);

    const handleDeleteEquipment = (item: Equipment) => {
        if (!item.id || !item.vsdId) {
            toast({ variant: "destructive", title: "Error", description: "Cannot delete equipment without an ID or VSD ID." });
            return;
        }
        const eqRef = doc(firestore, 'equipment', item.id);
        const vsdRef = doc(firestore, 'vsds', item.vsdId);

        deleteDocumentNonBlocking(eqRef);
        deleteDocumentNonBlocking(vsdRef);

        toast({
            title: 'Equipment Deleted',
            description: `${item.name} and its associated VSD have been removed.`,
        });
    };

    const getStatusVariant = (status?: Equipment['breakdownStatus']) => {
        switch (status) {
          case 'Active':
            return 'destructive';
          case 'Resolved':
          case 'Pending PO':
          case 'Awaiting OT':
            return 'secondary';
          case 'Signed Off':
          case 'Invoiced':
            return 'default';
          default:
            return 'outline';
        }
    };

  if (!memoizedDivisionName) {
    return null;
  }

  const isGroupedByLocation = true; // Always group for smelter view for now
  const locations = Object.keys(equipmentByLocation).sort();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Equipment: {memoizedDivisionName}</h1>
            <p className="text-muted-foreground">
            All monitored equipment in the {memoizedDivisionName} division.
            </p>
        </div>
        {!isClientManager && (
            <Link href="/equipment/new" passHref>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Equipment
              </Button>
            </Link>
        )}
      </header>
        {isLoading ? (
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center h-24 flex justify-center items-center">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      Loading equipment...
                    </div>
                </CardContent>
            </Card>
        ) : isGroupedByLocation ? (
             <Accordion type="multiple" className="w-full">
                {locations.map((location) => (
                    equipmentByLocation[location] && equipmentByLocation[location].length > 0 && (
                        <AccordionItem value={`item-${location}`} key={location}>
                            <AccordionTrigger className="text-xl font-semibold">
                                {location} ({equipmentByLocation[location].length})
                            </AccordionTrigger>
                            <AccordionContent>
                                <Card>
                                    <CardContent className="pt-6">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Assigned To</TableHead>
                                                    <TableHead>Breakdown Status</TableHead>
                                                    <TableHead className="text-right">Uptime</TableHead>
                                                    <TableHead className="text-right">Power (kWh)</TableHead>
                                                    {canDelete && <TableHead className="text-right">Actions</TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {equipmentByLocation[location].map((eq) => {
                                                    const now = new Date();
                                                    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                                    const totalHoursInMonth = daysInMonth * 24;
                                                    const downtimeHours = eq.totalDowntimeHours || 0;
                                                    const uptimeHours = totalHoursInMonth - downtimeHours;
                                                    const uptime = Math.max(0, (uptimeHours / totalHoursInMonth) * 100);
                                                    const runningHours = totalHoursInMonth - downtimeHours;
                                                    const powerConsumption = (eq.motorPower || 0) * runningHours;

                                                    return (
                                                        <TableRow key={eq.id}>
                                                            <TableCell className="font-medium">
                                                            <Link href={`/equipment/${eq.id}`} className="hover:underline text-primary">
                                                                {eq.name}
                                                            </Link>
                                                            </TableCell>
                                                            <TableCell>
                                                                {canDelete ? (
                                                                    <AssignTechnicianDropdown equipment={eq} users={allUsers} usersLoading={usersLoading} />
                                                                ) : (
                                                                    eq.assignedToName || 'Unassigned'
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant={getStatusVariant(eq.breakdownStatus)}>
                                                                    {eq.breakdownStatus || 'None'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                            <Badge variant={uptime > 99 ? 'default' : 'destructive'}>
                                                                {uptime.toFixed(2)}%
                                                            </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">{powerConsumption.toLocaleString()}</TableCell>
                                                            {canDelete && (
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => handleDeleteEquipment(eq)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            )}
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </AccordionContent>
                        </AccordionItem>
                    )
                ))}
            </Accordion>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Breakdown Status</TableHead>
                    <TableHead className="text-right">Uptime</TableHead>
                    <TableHead className="text-right">Power (kWh)</TableHead>
                    {canDelete && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment && equipment.length > 0 ? (
                    equipment.map((eq) => {
                        const now = new Date();
                        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                        const totalHoursInMonth = daysInMonth * 24;
                        const downtimeHours = eq.totalDowntimeHours || 0;
                        const uptimeHours = totalHoursInMonth - downtimeHours;
                        const uptime = Math.max(0, (uptimeHours / totalHoursInMonth) * 100);
                        const runningHours = totalHoursInMonth - downtimeHours;
                        const powerConsumption = (eq.motorPower || 0) * runningHours;

                        return (
                            <TableRow key={eq.id}>
                                <TableCell className="font-medium">
                                <Link href={`/equipment/${eq.id}`} className="hover:underline text-primary">
                                    {eq.name}
                                </Link>
                                </TableCell>
                                <TableCell>{eq.location}</TableCell>
                                <TableCell>
                                    {canDelete ? (
                                        <AssignTechnicianDropdown equipment={eq} users={allUsers} usersLoading={usersLoading} />
                                    ) : (
                                        eq.assignedToName || 'Unassigned'
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(eq.breakdownStatus)}>
                                        {eq.breakdownStatus || 'None'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                <Badge variant={uptime > 99 ? 'default' : 'destructive'}>
                                    {uptime.toFixed(2)}%
                                </Badge>
                                </TableCell>
                                <TableCell className="text-right">{powerConsumption.toLocaleString()}</TableCell>
                                {canDelete && (
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => handleDeleteEquipment(eq)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={canDelete ? 7 : 6} className="text-center h-24">No equipment found for this division.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
    </div>
  );
}


function UnauthenticatedFallback() {
    return (
        <Card className="flex flex-col items-center justify-center text-center p-8 gap-4">
            <CardTitle>Authentication Required</CardTitle>
            <CardContent>
                <p className="text-muted-foreground mb-4">Please log in to view equipment details.</p>
                <Link href="/auth/register" passHref>
                    <Button>
                        <LogIn className="mr-2 h-4 w-4" />
                        Login or Register
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}

export default function SmelterDivisionPage() {
    const { user, isUserLoading } = useUser();

    if (isUserLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!user) {
        return <UnauthenticatedFallback />;
    }

    return <AuthenticatedSmelterDivisionPage />;
}
