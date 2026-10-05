'use client';
import React, { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, getDocs } from 'firebase/firestore';

export function BreakdownTally({ equipmentId, equipmentName }: { equipmentId: string, equipmentName: string }) {
    const db = useFirestore();
    const currentYear = new Date().getFullYear().toString();
    const [total, setTotal] = useState<number | null>(null);

    useEffect(() => {
        if (!equipmentId || !equipmentName) return;
        let isMounted = true;
        
        const fetchTally = async () => {
            try {
                // Run all 4 queries concurrently over the single Firestore multiplexed connection
                const [fsrIdSnap, fsrNameSnap, bdIdSnap, bdNameSnap] = await Promise.all([
                    getDocs(query(collection(db, 'field_service_reports'), where('equipmentId', '==', equipmentId))),
                    getDocs(query(collection(db, 'field_service_reports'), where('assetName', '==', equipmentName))),
                    getDocs(query(collection(db, 'breakdown_reports'), where('equipmentId', '==', equipmentId))),
                    getDocs(query(collection(db, 'breakdown_reports'), where('equipmentName', '==', equipmentName)))
                ]);

                if (!isMounted) return;

                let count = 0;
                const uniqueIds = new Set<string>();

                fsrIdSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date.startsWith(currentYear) && !uniqueIds.has(doc.id)) {
                        count++; uniqueIds.add(doc.id);
                    }
                });
                fsrNameSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date.startsWith(currentYear) && data.equipmentId !== equipmentId && !uniqueIds.has(doc.id)) {
                        count++; uniqueIds.add(doc.id);
                    }
                });
                bdIdSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date.startsWith(currentYear) && !uniqueIds.has(doc.id)) {
                        count++; uniqueIds.add(doc.id);
                    }
                });
                bdNameSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.date && data.date.startsWith(currentYear) && data.equipmentId !== equipmentId && !uniqueIds.has(doc.id)) {
                        count++; uniqueIds.add(doc.id);
                    }
                });

                setTotal(count);
            } catch (e) {
                console.error("Failed to fetch breakdown tally", e);
                if (isMounted) setTotal(0);
            }
        };
        fetchTally();
        return () => { isMounted = false; };
    }, [db, equipmentId, equipmentName, currentYear]);

    if (total === null) return <span className="text-muted-foreground text-xs font-mono opacity-50">...</span>;
    if (total === 0) return <span className="text-muted-foreground text-xs font-mono">-</span>;

    return (
        <Badge variant={total > 2 ? "destructive" : "secondary"} className="font-mono px-2 py-0.5 shadow-sm text-[10px]">
            {total}
        </Badge>
    );
}

export function MaintenanceTally({ equipmentId, equipmentName }: { equipmentId: string, equipmentName: string }) {
    const db = useFirestore();
    const currentYear = new Date().getFullYear().toString();
    const [total, setTotal] = useState<number | null>(null);

    useEffect(() => {
        if (!equipmentId || !equipmentName) return;
        let isMounted = true;
        
        const fetchTally = async () => {
            try {
                // Concurrently fetch scheduled maintenance for this equipment only
                const [schedIdSnap, schedNameSnap] = await Promise.all([
                    getDocs(query(collection(db, 'completed_schedules'), where('equipmentId', '==', equipmentId))),
                    getDocs(query(collection(db, 'completed_schedules'), where('equipmentName', '==', equipmentName)))
                ]);

                if (!isMounted) return;

                let count = 0;
                const uniqueIds = new Set<string>();

                schedIdSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.completionDate && data.completionDate.startsWith(currentYear) && !uniqueIds.has(doc.id)) {
                        count++; uniqueIds.add(doc.id);
                    }
                });
                schedNameSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.completionDate && data.completionDate.startsWith(currentYear) && data.equipmentId !== equipmentId && !uniqueIds.has(doc.id)) {
                        count++; uniqueIds.add(doc.id);
                    }
                });

                setTotal(count);
            } catch (e) {
                console.error("Failed to fetch maintenance tally", e);
                if (isMounted) setTotal(0);
            }
        };
        fetchTally();
        return () => { isMounted = false; };
    }, [db, equipmentId, equipmentName, currentYear]);

    if (total === null) return <span className="text-muted-foreground text-xs font-mono opacity-50">...</span>;
    if (total === 0) return <span className="text-muted-foreground text-xs font-mono">-</span>;

    return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono px-2 py-0.5 shadow-sm text-[10px]">
            {total}
        </Badge>
    );
}
