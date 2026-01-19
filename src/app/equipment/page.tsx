
'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Equipment, User } from '@/lib/types';
import { Fan, Droplets, AirVent, PlusCircle, LogIn, Loader2, Trash2, Cable, Cog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import React from 'react';
import { AssignTechnicianDropdown } from '@/components/equipment/assign-technician-dropdown';

function AuthenticatedEquipmentPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const equipmentQuery = useMemoFirebase(() => {
    if (!user) return null; // Do not query if user is not logged in
    return query(collection(firestore, 'equipment'), where('plant', '==', 'Mining'));
  }, [firestore, user]);

  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);
  
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const canDelete = userData?.role && ['Admin', 'Superadmin'].includes(userData.role);
  const isClientManager = userData?.role === 'Client Manager';

  const isLoading = equipmentLoading || usersLoading;

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


  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Mining Equipment</h1>
            <p className="text-muted-foreground">
            View and manage all monitored equipment in the Mining plant.
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
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Breakdown Status</TableHead>
                <TableHead className="text-right">Uptime</TableHead>
                <TableHead className="text-right">Power (kWh)</TableHead>
                {canDelete && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canDelete ? 8 : 7} className="text-center h-24">Loading equipment...</TableCell>
                </TableRow>
              ) : equipment && equipment.length > 0 ? (
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
                            <TableCell>{eq.division || 'N/A'}</TableCell>
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
                    );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={canDelete ? 8 : 7} className="text-center h-24">No mining equipment found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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

export default function EquipmentPage() {
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

    return <AuthenticatedEquipmentPage />;
}
