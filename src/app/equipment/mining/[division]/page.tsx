
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
import { Fan, Droplets, AirVent, PlusCircle, LogIn, Loader2, Trash2, Cable, Cog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';

const validDivisions: Record<string, string> = {
    'boosters': 'Boosters',
    'dredgers': 'Dredgers',
    'pump-stations': 'Pump Stations',
    'ups-btus': 'UPS/BTU\'s',
    'cons-boosters': 'Cons Boosters',
}

function AuthenticatedMiningDivisionPage() {
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
        where('plant', '==', 'Mining'),
        where('division', '==', memoizedDivisionName)
    );
  }, [firestore, memoizedDivisionName, user]);

  const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);
  const canEdit = userData?.role && (userData.role.includes('Admin') || userData.role.includes('Superadmin') || userData.role === 'Technician');
  
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

  const isGroupedByLocation = ['Dredgers', 'Boosters', 'Pump Stations'].includes(memoizedDivisionName);
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
        <Link href="/equipment/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Equipment
          </Button>
        </Link>
      </header>
        {isLoading ? (
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center h-24">Loading equipment...</div>
                </CardContent>
            </Card>
        ) : isGroupedByLocation ? (
             <Accordion type="multiple" className="w-full" defaultValue={locations.map(l => `item-${l}`)}>
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
                                                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {equipmentByLocation[location].map((eq) => (
                                                  <TableRow key={eq.id}>
                                                    <TableCell className="font-medium">
                                                      <Link href={`/equipment/${eq.id}`} className="hover:underline text-primary">
                                                        {eq.name}
                                                      </Link>
                                                    </TableCell>
                                                    <TableCell>{eq.assignedToName || 'Unassigned'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusVariant(eq.breakdownStatus)}>
                                                            {eq.breakdownStatus || 'None'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                      <Badge variant={eq.uptime > 99 ? 'default' : 'destructive'}>
                                                        {eq.uptime}%
                                                      </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">{eq.powerConsumption.toLocaleString()}</TableCell>
                                                    {canEdit && (
                                                        <TableCell className="text-right">
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This will permanently delete the equipment <strong>{eq.name}</strong> and its associated VSD. This action cannot be undone.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteEquipment(eq)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </TableCell>
                                                    )}
                                                  </TableRow>
                                                ))}
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
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment && equipment.length > 0 ? (
                    equipment.map((eq) => (
                      <TableRow key={eq.id}>
                        <TableCell className="font-medium">
                          <Link href={`/equipment/${eq.id}`} className="hover:underline text-primary">
                            {eq.name}
                          </Link>
                        </TableCell>
                        <TableCell>{eq.location}</TableCell>
                        <TableCell>{eq.assignedToName || 'Unassigned'}</TableCell>
                        <TableCell>
                            <Badge variant={getStatusVariant(eq.breakdownStatus)}>
                                {eq.breakdownStatus || 'None'}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={eq.uptime > 99 ? 'default' : 'destructive'}>
                            {eq.uptime}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{eq.powerConsumption.toLocaleString()}</TableCell>
                         {canEdit && (
                            <TableCell className="text-right">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the equipment <strong>{eq.name}</strong> and its associated VSD. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteEquipment(eq)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 7 : 6} className="text-center h-24">No equipment found for this division.</TableCell>
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

export default function MiningDivisionPage() {
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

    return <AuthenticatedMiningDivisionPage />;
}

    
