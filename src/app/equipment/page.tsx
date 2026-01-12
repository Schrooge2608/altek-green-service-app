
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


const equipmentIcons: Record<string, React.ReactNode> = {
    Pump: <Droplets className="h-4 w-4 text-muted-foreground" />,
    Fan: <Fan className="h-4 w-4 text-muted-foreground" />,
    Compressor: <AirVent className="h-4 w-4 text-muted-foreground" />,
    Winch: <Cable className="h-4 w-4 text-muted-foreground" />,
    Motor: <Cog className="h-4 w-4 text-muted-foreground" />,
    'Hydraulic Motors': <Cog className="h-4 w-4 text-muted-foreground" />,
    Densifiers: <Cog className="h-4 w-4 text-muted-foreground" />,
    Mids: <Cog className="h-4 w-4 text-muted-foreground" />,
    Feeds: <Cog className="h-4 w-4 text-muted-foreground" />,
    Transfers: <Cog className="h-4 w-4 text-muted-foreground" />,
}

function AuthenticatedEquipmentPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const equipmentQuery = useMemoFirebase(() => {
    if (!user) return null; // Do not query if user is not logged in
    return query(collection(firestore, 'equipment'), where('plant', '==', 'Mining'));
  }, [firestore, user]);

  const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);

  const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc<User>(userRoleRef);
  const isKnownAdmin = userData?.role && (userData.role.includes('Admin') || userData.role.includes('Superadmin'));

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

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Mining Equipment</h1>
            <p className="text-muted-foreground">
            View and manage all monitored equipment in the Mining plant.
            </p>
        </div>
         <Link href="/equipment/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Equipment
          </Button>
        </Link>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Uptime</TableHead>
                <TableHead className="text-right">Power (kWh)</TableHead>
                {isKnownAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isKnownAdmin ? 7 : 6} className="text-center h-24">Loading equipment...</TableCell>
                </TableRow>
              ) : equipment && equipment.length > 0 ? (
                equipment.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell className="font-medium">
                      <Link href={`/equipment/${eq.id}`} className="hover:underline text-primary">
                        {eq.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                          {equipmentIcons[eq.type] || null}
                          {eq.type}
                      </div>
                    </TableCell>
                    <TableCell>{eq.division || 'N/A'}</TableCell>
                    <TableCell>{eq.location}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={eq.uptime > 99 ? 'default' : 'destructive'}>
                        {eq.uptime}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{eq.powerConsumption.toLocaleString()}</TableCell>
                    {isKnownAdmin && (
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
                  <TableCell colSpan={isKnownAdmin ? 7 : 6} className="text-center h-24">No mining equipment found.</TableCell>
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
