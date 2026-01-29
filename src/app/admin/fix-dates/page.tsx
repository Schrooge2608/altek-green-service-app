'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore } from '@/firebase';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import { Loader2, Wrench } from 'lucide-react';

export default function FixDatesPage() {
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready');

  const handleYearSwap = async () => {
    if (!firestore) {
      alert("Firestore is not available.");
      return;
    }
    setLoading(true);
    setStatus('Scanning for 2024 dates...');
    console.clear();
    try {
        const snap = await getDocs(collection(firestore, 'equipment'));
        const batch = writeBatch(firestore);
        let fixCount = 0;

        snap.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const rawDate = data.nextMaintenance;
            // Check if it's a string and has "2024" in it
            if (typeof rawDate === 'string' && rawDate.includes('2024')) {
                
                // SWAP THE YEAR
                const newDate = rawDate.replace('2024', '2026');
                
                console.log(`Swapping: ${data.name} | ${rawDate} -> ${newDate}`);
                const ref = doc(firestore, 'equipment', docSnap.id);
                batch.update(ref, { 
                    nextMaintenance: newDate,
                    status: 'active' // Ensure it's active since it's now in the future
                });
                fixCount++;
            }
        });

        if (fixCount > 0) {
            await batch.commit();
            alert(`Success! Swapped ${fixCount} items from 2024 to 2026.`);
            window.location.reload();
        } else {
            alert("No items found with '2024' in the date string.");
        }
    } catch (error) {
        console.error("Year Swap Failed:", error);
        alert("Error. Check console.");
    } finally {
        setLoading(false);
        setStatus('Done');
    }
  };

  const buttonText = () => {
      if (loading) return status;
      return 'Run Year Swap Script';
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Schedule Fix (Year Swap)</h1>
        <p className="text-muted-foreground">
          Run this script to find and replace all '2024' maintenance dates with '2026'.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Year Swap Script</CardTitle>
          <CardDescription>
            This tool will scan all equipment items. If an item's `nextMaintenance` date is a string containing '2024', it will be replaced with '2026'. This process uses a single batch write for efficiency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={handleYearSwap} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              {buttonText()}
            </Button>
            {status === 'Done' && (
                <p className="text-sm text-green-600">
                    Scan complete.
                </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
