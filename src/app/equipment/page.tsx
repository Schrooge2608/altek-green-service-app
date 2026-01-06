'use client';

import Link from 'next/link';
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Fan, Droplets, AirVent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const equipmentIcons: Record<string, React.ReactNode> = {
    Pump: <Droplets className="h-4 w-4 text-muted-foreground" />,
    Fan: <Fan className="h-4 w-4 text-muted-foreground" />,
    Compressor: <AirVent className="h-4 w-4 text-muted-foreground" />,
}

export default function EquipmentPage() {
  const firestore = useFirestore();
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Equipment</h1>
        <p className="text-muted-foreground">
          View and manage all monitored equipment.
        </p>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Plant</TableHead>
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
                    <TableCell>{eq.plant}</TableCell>
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
                  <TableCell colSpan={6} className="text-center h-24">No equipment found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
