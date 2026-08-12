'use client';

import React, { useEffect, useState } from 'react';
import { useFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

export default function SeedUpsPage() {
  const { firestore } = useFirebase();
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    async function seed() {
      if (!firestore) return;
      
      const mccs = [
        { mcc: 'Dredge MCC', division: 'Dredgers' },
        { mcc: 'MPA Surge Bin MCC', division: 'Surge Bin' },
        { mcc: 'MPA Concentrator MCC', division: 'Concentrator' },
        { mcc: 'MPA Tails Boosters MCC', division: 'Tails Boosters' },
        { mcc: 'MPA Cons Boosters MCC', division: 'Cons Boosters' },
      ];

      setStatus('Seeding...');

      try {
        for (const item of mccs) {
          const eqId = crypto.randomUUID();
          
          await setDoc(doc(collection(firestore, 'equipment'), eqId), {
            id: eqId,
            name: 'UPS/BTU',
            location: 'MPA',
            plant: 'Mining',
            division: item.division,
            mcc: item.mcc,
            upsType: 'UPS',
            status: 'active',
            assignedToName: 'Ntokozo'
          });
        }
        setStatus('Seeding Complete! You can now navigate away.');
      } catch (e: any) {
        setStatus(`Error: ${e.message}`);
      }
    }

    seed();
  }, [firestore]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center p-8 bg-slate-100 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Seeding UPS/BTU...</h1>
        <p>{status}</p>
      </div>
    </div>
  );
}
