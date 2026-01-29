'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Loader2, Wrench } from 'lucide-react';

export default function FixDatesPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [fixedCount, setFixedCount] = useState<number | null>(null);

  const handleBulkFix = async () => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available.',
      });
      return;
    }

    setIsLoading(true);
    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

    try {
      const equipmentRef = collection(firestore, 'equipment');
      const snap = await getDocs(equipmentRef);
      
      const updates = snap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        
        // Check if nextMaintenance exists and is a valid date string
        if (data.nextMaintenance && typeof data.nextMaintenance === 'string') {
          const currentNext = new Date(data.nextMaintenance);
          
          // Check if the date is valid and in the past
          if (!isNaN(currentNext.getTime()) && currentNext < today) {
            
            const newDate = new Date();
            newDate.setMonth(newDate.getMonth() + 3);
            const newDateString = newDate.toISOString().split('T')[0];
            
            await updateDoc(doc(firestore, 'equipment', docSnap.id), {
              nextMaintenance: newDateString
            });
            count++;
          }
        }
      });

      await Promise.all(updates);
      
      setFixedCount(count);
      toast({
        title: 'Bulk Update Complete!',
        description: `Fixed ${count} equipment records with overdue maintenance dates.`,
      });

    } catch (error: any) {
      console.error('Error fixing dates:', error);
      toast({
        variant: 'destructive',
        title: 'Error During Bulk Fix',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Schedule Fix</h1>
        <p className="text-muted-foreground">
          Run this script to find and update all equipment with overdue 'Next Maintenance' dates.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Fix Overdue Maintenance Dates</CardTitle>
          <CardDescription>
            This tool will scan all equipment. If an item's `nextMaintenance` date is in the past, it will be updated to 3 months from today. This is useful for correcting old data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={handleBulkFix} disabled={isLoading || fixedCount !== null}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              {fixedCount !== null ? `Fixed ${fixedCount} Records` : (isLoading ? 'Fixing Dates...' : 'Run Bulk Fix Script')}
            </Button>
            {fixedCount !== null && (
                <p className="text-sm text-green-600">
                    Update complete. You can navigate away from this page.
                </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
