'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import type { FieldServiceReport } from '@/lib/types';

export default function NewFSRPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const hasCreated = useRef(false);

  useEffect(() => {
    async function create() {
      if (!user || !firestore || hasCreated.current) return;
      hasCreated.current = true;

      const equipmentId = searchParams.get('equipmentId');
      let assetName = '';

      if (equipmentId) {
        try {
          const eqDoc = await getDoc(doc(firestore, 'equipment', equipmentId));
          if (eqDoc.exists()) {
             assetName = eqDoc.data().name || '';
          }
        } catch (e) {
          console.error(e);
        }
      }

      const refId = '';
      
      try {
        const newReport: Partial<FieldServiceReport> = {
          userId: user.uid,
          fsrReference: refId,
          date: new Date().toISOString().split('T')[0],
          status: 'Draft',
          createdAt: new Date().toISOString(),
          customer: '',
          assetName: assetName,
          parts: [],
          personnel: [],
          hse: {
            ppe: 'NA',
            riskAssessment: 'NA',
            permit: 'NA',
            incidents: 'NA',
            areaCleaned: 'NA',
            environmentalImpact: 'NA',
            observations: ''
          }
        };
        const docRef = await addDocumentNonBlocking(collection(firestore, 'field_service_reports'), newReport);
        router.replace(`/reports/field-service-report/${docRef.id}`);
      } catch (e) {
        console.error(e);
        router.replace('/reports/field-service-report');
      }
    }
    create();
  }, [user, firestore, router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] flex-col gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse">Initializing Field Service Report...</p>
    </div>
  );
}
