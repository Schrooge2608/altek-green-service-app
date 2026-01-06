'use client';

import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Equipment, Breakdown, VSD } from '@/lib/types';
import { useEffect } from 'react';

const imageMap: { [key: string]: string } = {
    Pump: "pump-1",
    Fan: "fan-1",
    Compressor: "compressor-1",
};

export default function EquipmentDetailPage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();

  const eqRef = useMemoFirebase(() => doc(firestore, 'equipment', params.id), [firestore, params.id]);
  const { data: eq, isLoading: eqLoading, error: eqError } = useDoc<Equipment>(eqRef);

  const vsdRef = useMemoFirebase(() => (eq ? doc(firestore, 'vsds', eq.vsdId) : null), [firestore, eq]);
  const { data: eqVsd, isLoading: vsdLoading } = useDoc<VSD>(vsdRef);
  
  const breakdownsQuery = useMemoFirebase(() => (eq ? query(collection(firestore, 'breakdown_reports'), where('equipmentId', '==', eq.id)) : null), [firestore, eq]);
  const { data: eqBreakdowns, isLoading: breakdownsLoading } = useCollection<Breakdown>(breakdownsQuery);

  const placeholder = eq ? PlaceHolderImages.find(p => p.id === imageMap[eq.type]) : null;

  useEffect(() => {
    if (!eqLoading && !eq) {
      notFound();
    }
  }, [eq, eqLoading]);


  if (eqLoading || vsdLoading || breakdownsLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <p>Loading equipment details...</p>
        </div>
    );
  }

  if (!eq) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{eq.name}</h1>
        <p className="text-muted-foreground">Detailed view of equipment ID: {eq.id}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Equipment Details</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
                    <div>
                        <h3 className="font-semibold text-muted-foreground">Information</h3>
                        <div className="mt-2 space-y-1">
                            <p><strong>ID:</strong> {eq.id}</p>
                            <p><strong>Type:</strong> {eq.type}</p>
                            <p><strong>Location:</strong> {eq.location}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-muted-foreground">VSD Control</h3>
                         <div className="mt-2 space-y-1">
                            <p><strong>VSD ID:</strong> {eq.vsdId}</p>
                            <p><strong>VSD Model:</strong> {eqVsd?.model || 'N/A'}</p>
                        </div>
                    </div>
                     <div>
                        <h3 className="font-semibold text-muted-foreground">Specifications</h3>
                         <div className="mt-2 space-y-1">
                            <p><strong>Pump Head:</strong> {eq.pumpHead > 0 ? `${eq.pumpHead}m` : 'N/A'}</p>
                            <p><strong>Flow Rate:</strong> {eq.flowRate > 0 ? `${eq.flowRate} m³/h`: 'N/A'}</p>
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-muted-foreground">Maintenance</h3>
                         <div className="mt-2 space-y-1">
                            <p><strong>Last:</strong> {eq.lastMaintenance}</p>
                            <p><strong>Next:</strong> {eq.nextMaintenance}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Breakdown History</CardTitle>
                        <CardDescription>Log of all reported issues for this equipment.</CardDescription>
                    </div>
                    <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Log Breakdown</Button>
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
                            {eqBreakdowns && eqBreakdowns.length > 0 ? eqBreakdowns.map(b => (
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
            {placeholder && (
                <Card className="overflow-hidden">
                    <Image 
                        src={placeholder.imageUrl}
                        alt={eq.name}
                        width={600}
                        height={400}
                        className="w-full h-auto object-cover"
                        data-ai-hint={placeholder.imageHint}
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
                        <span className="font-bold">{eq.uptime}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Power Consumption</span>
                        <span className="font-bold">{eq.powerConsumption} kWh</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={eqVsd?.status === 'active' ? 'default' : (eqVsd?.status === 'maintenance' ? 'secondary' : 'destructive')}>{eqVsd?.status || 'Unknown'}</Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
