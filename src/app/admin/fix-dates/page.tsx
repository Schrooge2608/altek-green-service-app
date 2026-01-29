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
  const [status, setStatus] = useState('Ready to Scan');

  const handleUniversalFix = async () => {
    if (!firestore) {
        alert("Firestore is not available.");
        return;
    }
    setLoading(true);
    console.clear();
    setStatus('Scanning...');

    try {
      const snap = await getDocs(collection(firestore, 'equipment'));
      const batch = writeBatch(firestore);
      let fixCount = 0;
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const rawVal = data.nextMaintenance;
        let dateObj: Date | null = null;
        // 1. DETECT DATE TYPE
        if (rawVal && typeof rawVal === 'object' && 'toDate' in rawVal) {
          dateObj = rawVal.toDate(); // It's a Firestore Timestamp
        } else if (typeof rawVal === 'string') {
          dateObj = new Date(rawVal); // It's a String
        }
        // 2. CHECK YEAR & FIX
        if (dateObj && !isNaN(dateObj.getTime())) {
          const year = dateObj.getFullYear();
          
          if (year === 2024) {
            // Add exactly 2 years
            dateObj.setFullYear(2026);
            const newDateString = dateObj.toISOString().split('T')[0];
            console.log(`Fixing ${data.name}: ${year} -> 2026 (${newDateString})`);
            
            const ref = doc(firestore, 'equipment', docSnap.id);
            batch.update(ref, { 
              nextMaintenance: newDateString,
              status: 'active'
            });
            fixCount++;
          }
        }
      });
      if (fixCount > 0) {
        await batch.commit();
        alert(`Success! Updated ${fixCount} items from 2024 to 2026.`);
        window.location.reload();
      } else {
        alert("Scan complete. No 2024 dates found (Check Console F12 for details).");
      }
    } catch (error) {
      console.error("Fix Failed:", error);
      alert("Error! Check Console.");
    } finally {
      setLoading(false);
      setStatus('Done');
    }
  };

  const buttonText = () => {
      if (loading) return status;
      return 'Run Universal Fix';
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Schedule Fix (Timestamp Aware)</h1>
        <p className="text-muted-foreground">
          Run this script to find and replace all '2024' maintenance dates with '2026'.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Universal Fix Script</CardTitle>
          <CardDescription>
            This tool will scan all equipment items, handle both String and Timestamp dates, and update any '2024' year to '2026'. This process uses a single batch write for efficiency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={handleUniversalFix} disabled={loading}>
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