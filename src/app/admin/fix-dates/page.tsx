'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import { Loader2, Wrench } from 'lucide-react';

export default function FixDatesPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [fixedCount, setFixedCount] = useState<number | null>(null);


  const handleAggressiveFix = async () => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available.',
      });
      return;
    }
    setLoading(true);
    setStatus('Scanning database...');
    setFixedCount(null);
    console.clear();
    console.log("--- STARTING DEEP CLEAN ---");

    try {
      const equipmentRef = collection(firestore, 'equipment');
      const snap = await getDocs(equipmentRef);
      const total = snap.size;
      console.log(`Found ${total} items.`);
      
      const batch = writeBatch(firestore);
      let fixCount = 0;
      let skippedCount = 0;
      
      const targetDate = new Date('2026-01-01');

      snap.docs.forEach((docSnap, index) => {
        const data = docSnap.data();
        
        if (index < 5) {
          console.log(`Item ${index}: ${data.name}`, data);
        }

        const rawDate = data.nextMaintenance;
        let needsUpdate = false;
        let cleanDate: Date | null = null;
        
        if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate) {
          cleanDate = rawDate.toDate();
        } else if (typeof rawDate === 'string') {
          cleanDate = new Date(rawDate);
        }
        
        if (!cleanDate || isNaN(cleanDate.getTime())) {
          console.warn(`Invalid Date found for ${data.name}:`, rawDate);
          needsUpdate = true;
        } else if (cleanDate < targetDate) {
          console.log(`Old Date found for ${data.name}: ${cleanDate.toISOString().split('T')[0]}`);
          needsUpdate = true;
        } else {
          skippedCount++;
        }
        
        if (needsUpdate) {
          const newDate = new Date();
          newDate.setMonth(newDate.getMonth() + 3);
          const newDateString = newDate.toISOString().split('T')[0];
          const ref = doc(firestore, 'equipment', docSnap.id);
          batch.update(ref, { 
            nextMaintenance: newDateString,
            status: 'active' 
          });
          fixCount++;
        }
      });

      if (fixCount > 0) {
        setStatus(`Committing ${fixCount} fixes...`);
        await batch.commit();
        setFixedCount(fixCount);
        toast({
            title: 'Deep Clean Complete!',
            description: `SUCCESS: Fixed ${fixCount} items! (Skipped ${skippedCount} that were already okay)`,
        });
      } else {
        setFixedCount(0);
        toast({
            title: 'No Items to Fix',
            description: `No items needed fixing. Checked ${total} records.`,
        });
      }
    } catch (error: any) {
      console.error("Deep Clean Failed:", error);
      toast({
        variant: 'destructive',
        title: 'Error during Deep Clean',
        description: error.message || 'An unknown error occurred. Check console for details.',
      });
    } finally {
      setLoading(false);
      setStatus('Done');
    }
  };

  const buttonText = () => {
      if (loading) return status;
      if (fixedCount !== null) return `Run Again (Fixed ${fixedCount})`;
      return 'Run Deep Clean Script';
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Schedule Fix (Deep Clean)</h1>
        <p className="text-muted-foreground">
          Run this aggressive script to find and update all equipment with overdue 'Next Maintenance' dates using a batch write.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Deep Clean Old Maintenance Dates</CardTitle>
          <CardDescription>
            This tool will scan all equipment items. If an item's `nextMaintenance` date is invalid or before January 2026, it will be updated to 3 months from today. This process uses a batch write for efficiency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={handleAggressiveFix} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              {buttonText()}
            </Button>
            {status === 'Done' && (
                <p className="text-sm text-green-600">
                    Scan complete. {fixedCount !== null && `Fixed ${fixedCount} records.`}
                </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
