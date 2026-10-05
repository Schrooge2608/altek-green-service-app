'use client';
import React, { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

export function BreakdownTally({ equipmentId, equipmentName }: { equipmentId: string, equipmentName: string }) {
    const db = useFirestore();
    const currentYear = new Date().getFullYear().toString();
    const [total, setTotal] = React.useState<number | null>(null);

    React.useEffect(() => {
        if (!equipmentId || !equipmentName) return;
        
        const fetchTally = async () => {
            try {
                let count = 0;
                
                // Fetch FSRs by ID
                const fsrIdSnap = await getDocs(query(collection(db, 'field_service_reports'), where('equipmentId', '==', equipmentId)));
                fsrIdSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date.startsWith(currentYear)) count++;
                });

                // Fetch FSRs by Name (fallback)
                const fsrNameSnap = await getDocs(query(collection(db, 'field_service_reports'), where('assetName', '==', equipmentName)));
                fsrNameSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date.startsWith(currentYear) && data.equipmentId !== equipmentId) count++;
                });

                // Fetch Breakdowns by ID
                const bdIdSnap = await getDocs(query(collection(db, 'breakdown_reports'), where('equipmentId', '==', equipmentId)));
                bdIdSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date.startsWith(currentYear)) count++;
                });

                // Fetch Breakdowns by Name (fallback)
                const bdNameSnap = await getDocs(query(collection(db, 'breakdown_reports'), where('equipmentName', '==', equipmentName)));
                bdNameSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date.startsWith(currentYear) && data.equipmentId !== equipmentId) count++;
                });

                setTotal(count);
            } catch (e) {
                console.error("Failed to fetch tally", e);
                setTotal(0);
            }
        };
        fetchTally();
    }, [db, equipmentId, equipmentName, currentYear]);

    if (total === null) return <span className="text-muted-foreground text-xs font-mono opacity-50">...</span>;
    if (total === 0) return <span className="text-muted-foreground text-xs font-mono">-</span>;

    return (
        <Badge variant={total > 2 ? "destructive" : "secondary"} className="font-mono px-2 py-0.5 shadow-sm text-[10px]">
            {total}
        </Badge>
    );
}
