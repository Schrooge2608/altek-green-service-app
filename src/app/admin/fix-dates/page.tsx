'use client';
import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Wrench } from 'lucide-react';

export default function FixDatesPage() { 
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false); 
  const [status, setStatus] = useState('Ready');

  const handleLastMaintenanceFix = async () => { 
    if (!firestore) {
      alert("Firestore is not available.");
      return;
    }
    setLoading(true); 
    setStatus('Scanning for 2024 Last Maintenance...'); 
    console.clear();

    try {
      const snap = await getDocs(collection(firestore, 'equipment'));
      const batch = writeBatch(firestore);
      let fixCount = 0;
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const lastMaint = data.lastMaintenance; // The culprit field
        // Check if it exists and has "2024" in the string
        if (typeof lastMaint === 'string' && lastMaint.includes('2024')) {
          
          // 1. Fix the Last Maintenance Date (Swap 2024 -> 2026)
          const newLastMaint = lastMaint.replace('2024', '2026');
          
          // 2. Calculate a healthy "Next Maintenance" (3 months after the new Last Maint)
          const dateObj = new Date(newLastMaint);
          dateObj.setMonth(dateObj.getMonth() + 3);
          const newNextMaint = dateObj.toISOString().split('T')[0];
          console.log(`Fixing ${data.name}: Last (${lastMaint} -> ${newLastMaint}) | Next -> ${newNextMaint}`);
          const ref = doc(firestore, 'equipment', docSnap.id);
          batch.update(ref, { 
            lastMaintenance: newLastMaint,
            nextMaintenance: newNextMaint,
            status: 'active' // Force it to be Green
          });
          fixCount++;
        }
      });
      if (fixCount > 0) {
        await batch.commit();
        alert(`Success! Fixed ${fixCount} items. Last Maintenance is now 2026.`);
        window.location.reload();
      } else {
        alert("No items found with '2024' in lastMaintenance field.");
      }
    } catch (error) {
      console.error("Fix Failed:", error);
      alert("Error! Check Console.");
    } finally {
      setLoading(false);
      setStatus('Done');
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Schedule Fix (Last Maintenance)</h1>
        <p className="text-muted-foreground">
          Run this script to find and replace all '2024' `lastMaintenance` dates with '2026' and update the `nextMaintenance` date accordingly.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Last Maintenance Fix Script</CardTitle>
          <CardDescription>
            This tool will scan all equipment items, and for any item where 'lastMaintenance' is in 2024, it will update it to 2026 and set 'nextMaintenance' to 3 months after that.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Button onClick={handleLastMaintenanceFix} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              {loading ? status : 'Run Last Maintenance Fix'}
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
