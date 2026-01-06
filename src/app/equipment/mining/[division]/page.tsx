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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Fan, Droplets, AirVent, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';

const equipmentIcons: Record<string, React.ReactNode> = {
    Pump: <Droplets className="h-4 w-4 text-muted-foreground" />,
    Fan: <Fan className="h-4 w-4 text-muted-foreground" />,
    Compressor: <AirVent className="h-4 w-4 text-muted-foreground" />,
}

const validDivisions: Record<string, string> = {
    'dredgers': 'Dredgers',
    'boosters': 'Boosters',
    'pump-stations': 'Pump Stations',
}

export default function MiningDivisionPage() {
  const params = useParams();
  const divisionSlug = Array.isArray(params.division) ? params.division[0] : params.division;
  
  const memoizedDivisionName = useMemo(() => {
    if (!divisionSlug || !validDivisions[divisionSlug]) {
        notFound();
    }
    return validDivisions[divisionSlug];
  }, [divisionSlug]);

  const firestore = useFirestore();
  
  const equipmentQuery = useMemoFirebase(() => {
    if (!memoizedDivisionName) return null;
    return query(
        collection(firestore, 'equipment'), 
        where('plant', '==', 'Mining'),
        where('division', '==', memoizedDivisionName)
    );
  }, [firestore, memoizedDivisionName]);
  
  const { data: equipment, isLoading } = useCollection<Equipment>(equipmentQuery);
  
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

  if (!memoizedDivisionName) {
    return null;
  }

  // Only group by location if the division is NOT dredgers, boosters, or pump stations
  const isGroupedByLocation = !['Dredgers', 'Boosters', 'Pump Stations'].includes(memoizedDivisionName);
  const locations = Object.keys(equipmentByLocation);

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
                    equipmentByLocation[location] && (
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
                                                    <TableHead>Type</TableHead>
                                                    <TableHead className="text-right">Uptime</TableHead>
                                                    <TableHead className="text-right">Power (kWh)</TableHead>
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
                                                    <TableCell>
                                                      <div className="flex items-center gap-2">
                                                          {equipmentIcons[eq.type] || null}
                                                          {eq.type}
                                                      </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                      <Badge variant={eq.uptime > 99 ? 'default' : 'destructive'}>
                                                        {eq.uptime}%
                                                      </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">{eq.powerConsumption.toLocaleString()}</TableCell>
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
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Uptime</TableHead>
                    <TableHead className="text-right">Power (kWh)</TableHead>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                              {equipmentIcons[eq.type] || null}
                              {eq.type}
                          </div>
                        </TableCell>
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
                      <TableCell colSpan={5} className="text-center h-24">No equipment found for this division.</TableCell>
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
