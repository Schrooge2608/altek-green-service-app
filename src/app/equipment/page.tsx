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
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Fan, Droplets, AirVent, PlusCircle, LogIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


const equipmentIcons: Record<string, React.ReactNode> = {
    Pump: <Droplets className="h-4 w-4 text-muted-foreground" />,
    Fan: <Fan className="h-4 w-4 text-muted-foreground" />,
    Compressor: <AirVent className="h-4 w-4 text-muted-foreground" />,
}

function AuthenticatedEquipmentPage() {
  const firestore = useFirestore();
  const equipmentQuery = useMemoFirebase(() => query(collection(firestore, 'equipment'), where('plant', '==', 'Mining')), [firestore]);
  const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">Loading equipment...</TableCell>
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
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">No mining equipment found.</TableCell>
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
        return <div className="text-center p-8">Loading...</div>;
    }

    if (!user) {
        return <UnauthenticatedFallback />;
    }

    return <AuthenticatedEquipmentPage />;
}
