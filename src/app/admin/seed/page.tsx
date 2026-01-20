
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { equipmentToSeed } from '@/lib/seed-data';
import type { Equipment, VSD } from '@/lib/types';
import { useState } from 'react';
import { Loader2, Database } from 'lucide-react';

export default function SeedPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeded, setIsSeeded] = useState(false);

  const hasDataToSeed = equipmentToSeed.length > 0;

  async function seedDatabase() {
    if (!firestore) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Firestore is not initialized.'
        });
        return;
    }
    if (!hasDataToSeed) {
        toast({
            variant: 'secondary',
            title: 'No Data',
            description: 'There is no data in the seed file to upload.'
        });
        return;
    }

    setIsLoading(true);
    const batch = writeBatch(firestore);

    equipmentToSeed.forEach((item, index) => {
        // Use a more generic ID generation or ensure IDs are provided in the data
        const equipmentId = `${item.location.slice(0,3).toLowerCase()}-${item.name.replace(/\s/g, '').slice(0,4).toLowerCase()}-${String(index + 1).padStart(3, '0')}`;
        const vsdId = `vsd-${equipmentId}`;
        
        const { model, serialNumber, installationDate, driveType, manufacturer, ...baseEq } = item;

        const equipmentDoc: Omit<Equipment, 'status' | 'model' | 'serialNumber' | 'installationDate'> = {
            ...baseEq,
            id: equipmentId,
            vsdId: vsdId,
        };
        
        const vsdDoc: VSD = {
            id: vsdId,
            driveType: driveType ?? 'VSD',
            equipmentId: equipmentId,
            model: model,
            manufacturer: manufacturer ?? '',
            serialNumber: serialNumber,
            installationDate: installationDate,
            status: 'active',
        };

        const equipmentRef = doc(firestore, 'equipment', equipmentId);
        batch.set(equipmentRef, equipmentDoc, { merge: true });

        const vsdRef = doc(firestore, 'vsds', vsdId);
        batch.set(vsdRef, vsdDoc, { merge: true });
    });

    try {
      await batch.commit();
      toast({
        title: 'Database Seeded Successfully!',
        description: `${equipmentToSeed.length} records have been added to the database.`,
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
          <CardTitle>Upload Seed Data</CardTitle>
          <CardDescription>
            This action will add all records from the `src/lib/seed-data.ts` file to the database. 
            Add data to the file and click the button to upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={seedDatabase} disabled={isLoading || isSeeded || !hasDataToSeed}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              {isSeeded ? 'Data Uploaded' : (hasDataToSeed ? `Upload ${equipmentToSeed.length} Records` : 'No Data to Upload')}
            </Button>
            {isSeeded && <p className="text-sm text-green-600">Seeding complete. You can clear the seed file now.</p>}
            {!hasDataToSeed && !isSeeded && <p className="text-sm text-muted-foreground">The seed file is currently empty.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    
