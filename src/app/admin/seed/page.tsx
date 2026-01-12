
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { pumpStations } from '@/lib/seed-data';
import type { Equipment, VSD } from '@/lib/types';
import { useState } from 'react';
import { Loader2, Database } from 'lucide-react';
import { format } from 'date-fns';

export default function SeedPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeded, setIsSeeded] = useState(false);

  async function seedDatabase() {
    setIsLoading(true);
    const batch = writeBatch(firestore);

    pumpStations.forEach((pump, index) => {
        const equipmentId = `pump-station-${String(index + 1).padStart(3, '0')}`;
        const vsdId = `vsd-ps-${String(index + 1).padStart(3, '0')}`;
        
        const { model, serialNumber, ...baseEq } = pump;

        const equipmentDoc: Equipment = {
            ...baseEq,
            id: equipmentId,
            vsdId: vsdId,
            model: pump.model,
            serialNumber: pump.serialNumber,
            installationDate: pump.installationDate,
            status: pump.status,
        };
        
        const vsdDoc: VSD = {
            id: vsdId,
            equipmentId: equipmentId,
            model: pump.model,
            serialNumber: pump.serialNumber,
            installationDate: pump.installationDate,
            status: 'active',
        };

        const equipmentRef = doc(firestore, 'equipment', equipmentId);
        batch.set(equipmentRef, equipmentDoc);

        const vsdRef = doc(firestore, 'vsds', vsdId);
        batch.set(vsdRef, vsdDoc);
    });

    try {
      await batch.commit();
      toast({
        title: 'Database Seeded Successfully!',
        description: `${pumpStations.length} pump stations have been added to the database.`,
      });
      setIsSeeded(true);
    } catch (error: any) {
      console.error('Error seeding database:', error);
      toast({
        variant: 'destructive',
        title: 'Error Seeding Database',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Seed Database</h1>
        <p className="text-muted-foreground">
          Populate the Firestore database with initial data for development.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Seed Pump Stations</CardTitle>
          <CardDescription>
            This action will add {pumpStations.length} pump station records to the 'equipment' and 'vsds' collections. This should only be run once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={seedDatabase} disabled={isLoading || isSeeded}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              {isSeeded ? 'Database Already Seeded' : 'Seed Database'}
            </Button>
            {isSeeded && <p className="text-sm text-green-600">Seeding complete. You can now remove this page.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
