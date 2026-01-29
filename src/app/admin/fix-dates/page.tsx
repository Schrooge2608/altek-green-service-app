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
    setFixedCount(null); // Reset count on new run
    console.log("Starting Bulk Fix Scan...");
  
    try {
      const equipmentRef = collection(firestore, 'equipment');
      const snap = await getDocs(equipmentRef);
      console.log(`Found ${snap.size} total equipment records.`);
      
      let count = 0;
      const updates = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const rawDate = data.nextMaintenance;
        
        let currentDate: Date | null = null;
        // 1. Handle Firestore Timestamp (Object with .toDate())
        if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate) {
          currentDate = rawDate.toDate();
        } 
        // 2. Handle String ("2024-01-01")
        else if (typeof rawDate === 'string') {
          currentDate = new Date(rawDate);
        }

        // 3. Check Date - If date is missing, invalid, or in the past (before Jan 1, 2026)
        if (!currentDate || isNaN(currentDate.getTime()) || currentDate < new Date('2026-01-01')) {
          
          console.log(`Fixing item: ${data.name} (Old Date: ${rawDate})`);
          
          // Calculate new date (Default +3 months from today)
          const newDate = new Date();
          newDate.setMonth(newDate.getMonth() + 3);
          const newDateString = newDate.toISOString().split('T')[0];

          // Push update promise
          updates.push(
            updateDoc(doc(firestore, 'equipment', docSnap.id), {
              nextMaintenance: newDateString,
              status: 'active' // Force status to active too
            })
          );
          count++;
        }
      }

      // Execute all updates
      await Promise.all(updates);

      console.log(`Successfully updated ${count} records.`);
      setFixedCount(count);
      toast({
        title: 'Bulk Update Complete!',
        description: `Fixed ${count} equipment records with overdue maintenance dates.`,
      });

    } catch (error: any) { 
      console.error("Bulk Fix Failed:", error);
      toast({
        variant: 'destructive',
        title: 'Error During Bulk Fix',
        description: error.message || 'An unknown error occurred. Check the console for details.',
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
            This tool will scan all equipment. If an item's `nextMaintenance` date is in the past (before Jan 2026), it will be updated to 3 months from today. This is useful for correcting old data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={handleBulkFix} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Fixing Dates...' : (fixedCount !== null ? `Run Again (Fixed ${fixedCount})` : 'Run Bulk Fix Script')}
            </Button>
            {fixedCount !== null && (
                <p className="text-sm text-green-600">
                    Update complete. You can run this again if needed.
                </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
