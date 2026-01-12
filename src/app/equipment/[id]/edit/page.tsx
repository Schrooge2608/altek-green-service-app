
'use client';

import { notFound, useParams } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Equipment } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function EditEquipmentPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const firestore = useFirestore();

  const eqRef = useMemoFirebase(() => (id ? doc(firestore, 'equipment', id) : null), [firestore, id]);
  const { data: eq, isLoading: eqLoading } = useDoc<Equipment>(eqRef);

  if (eqLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="ml-2">Loading equipment data...</p>
      </div>
    );
  }

  if (!eq) {
    notFound();
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Edit Equipment: {eq.name}</h1>
        <p className="text-muted-foreground">
          Below are the details for the selected equipment cluster.
        </p>
      </header>

      <Card>
        <CardHeader>
            <CardTitle>Equipment Cluster Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>ID:</strong> {eq.id}</div>
            <div><strong>Plant:</strong> {eq.plant}</div>
            <div><strong>Division:</strong> {eq.division || 'N/A'}</div>
            <div><strong>Location:</strong> {eq.location}</div>
        </CardContent>
      </Card>
    </div>
  );
}
