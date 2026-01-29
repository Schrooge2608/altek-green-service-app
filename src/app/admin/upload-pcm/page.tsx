
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';

const pcmData = [
  {
    name: "East strand",
    type: "VSD",
    manufacturer: "Control Techniques",
    model: "UNISP",
    location: "Iron Injection - PCM2",
    plant: "Smelter",
    division: "Iron Injection",
    serialNumber: 'PCM2-SN-001',
  },
  {
    name: "West strand",
    type: "VSD",
    manufacturer: "Control Techniques",
    model: "UNISP",
    location: "Iron Injection - PCM2",
    plant: "Smelter",
    division: "Iron Injection",
    serialNumber: 'PCM2-SN-002',
  },
  {
    name: "Mould Wash Spray Pump East",
    type: "VSD",
    manufacturer: "Control Techniques",
    model: "UNISP",
    location: "Iron Injection - PCM2",
    plant: "Smelter",
    division: "Iron Injection",
    serialNumber: 'PCM2-SN-003',
  }
];

export default function UploadPcmPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);

  async function forceUpload() {
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Firestore is not initialized.' });
        return;
    }

    setIsLoading(true);
    const batch = writeBatch(firestore);
    const installationDate = '2026-01-06';
    const lastMaintenanceDate = '2026-01-05';
    const nextMaintenanceDate = format(new Date(new Date('2026-01-05').setMonth(new Date('2026-01-05').getMonth() + 3)), "yyyy-MM-dd");

    const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-');

    pcmData.forEach((item, index) => {
        const locationSlug = slugify(item.location);
        const nameSlug = slugify(item.name);
        const equipmentId = `${locationSlug}-${nameSlug}`;
        const vsdId = `vsd-${equipmentId}`;

        const equipmentDoc = {
            id: equipmentId,
            name: item.name,
            location: item.location,
            plant: item.plant,
            division: item.division,
            vsdId: vsdId,
            status: 'active',
            lastMaintenance: lastMaintenanceDate,
            nextMaintenance: nextMaintenanceDate,
            totalDowntimeHours: 0,
            breakdownStatus: 'None',
        };

        const vsdDoc = {
            id: vsdId,
            driveType: item.type as 'VSD' | 'Soft Starter',
            equipmentId: equipmentId,
            model: item.model,
            manufacturer: item.manufacturer,
            serialNumber: item.serialNumber,
            installationDate: installationDate,
            status: 'active',
        };

        const equipmentRef = doc(firestore, 'equipment', equipmentId);
        batch.set(equipmentRef, JSON.parse(JSON.stringify(equipmentDoc)), { merge: true });

        const vsdRef = doc(firestore, 'vsds', vsdId);
        batch.set(vsdRef, JSON.parse(JSON.stringify(vsdDoc)), { merge: true });
    });

    try {
      await batch.commit();
      toast({
        title: 'Upload Successful!',
        description: `${pcmData.length} PCM2 records have been force-uploaded to the database.`,
      });
      setIsUploaded(true);
    } catch (error: any) {
      console.error('Error force-uploading data:', error);
      toast({
        variant: 'destructive',
        title: 'Error Uploading Data',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Force Upload PCM Data</h1>
        <p className="text-muted-foreground">
          A temporary page to manually upload specific equipment data, bypassing the seed script.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Manual PCM2 Data Upload</CardTitle>
          <CardDescription>
            This action will add {pcmData.length} hardcoded records for PCM2 to the database. This should only be used if the main seed script is failing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={forceUpload} disabled={isLoading || isUploaded}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              {isUploaded ? 'Data Uploaded' : `Force Upload ${pcmData.length} Records`}
            </Button>
            {isUploaded && <p className="text-sm text-green-600">Upload complete. You can navigate away from this page.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
