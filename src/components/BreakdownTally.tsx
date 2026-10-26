'use client';
import React, { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { collection, query, where, getDocs } from 'firebase/firestore';

// In-memory session caches to eliminate duplicate Firestore queries across pages
const breakdownCache = new Map<string, number>();
const maintenanceCache = new Map<string, number>();

// In-flight promises to deduplicate concurrent requests for the exact same equipment
const inFlightBreakdowns = new Map<string, Promise<number>>();
const inFlightMaintenance = new Map<string, Promise<number>>();

// Concurrency worker queue: max 2 active queries to prevent choking the Firestore WebChannel
type QueueTask = () => Promise<void>;
const taskQueue: QueueTask[] = [];
let activeWorkers = 0;
const MAX_CONCURRENT = 2;

function processQueue() {
    while (activeWorkers < MAX_CONCURRENT && taskQueue.length > 0) {
        const task = taskQueue.shift();
        if (task) {
            activeWorkers++;
            task().finally(() => {
                activeWorkers--;
                processQueue();
            });
        }
    }
}

function enqueueTask(task: QueueTask) {
    taskQueue.push(task);
    processQueue();
}

export function BreakdownTally({ equipmentId, equipmentName }: { equipmentId: string, equipmentName: string }) {
    const db = useFirestore();
    const currentYear = new Date().getFullYear().toString();
    
    // Check in-memory cache synchronously on first render
    const cachedCount = breakdownCache.get(equipmentId) ?? breakdownCache.get(equipmentName);
    const [total, setTotal] = useState<number | null>(cachedCount !== undefined ? cachedCount : null);

    useEffect(() => {
        if (!equipmentId && !equipmentName) return;
        
        // Already cached? Nothing to do!
        const existing = breakdownCache.get(equipmentId) ?? breakdownCache.get(equipmentName);
        if (existing !== undefined) {
            setTotal(existing);
            return;
        }

        let isMounted = true;
        const cacheKey = equipmentId || equipmentName;

        const executeFetch = async (): Promise<number> => {
            try {
                const queries = [];
                if (equipmentId) {
                    queries.push(getDocs(query(collection(db, 'field_service_reports'), where('equipmentId', '==', equipmentId))));
                    queries.push(getDocs(query(collection(db, 'field_service_reports'), where('equipmentIds', 'array-contains', equipmentId))));
                    queries.push(getDocs(query(collection(db, 'breakdown_reports'), where('equipmentId', '==', equipmentId))));
                }
                if (equipmentName && equipmentName !== equipmentId) {
                    queries.push(getDocs(query(collection(db, 'field_service_reports'), where('assetName', '==', equipmentName))));
                    queries.push(getDocs(query(collection(db, 'field_service_reports'), where('assetNames', 'array-contains', equipmentName))));
                    queries.push(getDocs(query(collection(db, 'breakdown_reports'), where('equipmentName', '==', equipmentName))));
                }

                const snaps = await Promise.all(queries);
                let count = 0;
                const uniqueIds = new Set<string>();

                snaps.forEach(snap => {
                    snap.forEach(doc => {
                        const data = doc.data();
                        if (data.date && data.date.startsWith(currentYear) && !uniqueIds.has(doc.id)) {
                            count++;
                            uniqueIds.add(doc.id);
                        }
                    });
                });

                if (equipmentId) breakdownCache.set(equipmentId, count);
                if (equipmentName) breakdownCache.set(equipmentName, count);

                return count;
            } catch (e) {
                console.error("Failed to fetch breakdown tally", e);
                return 0;
            } finally {
                inFlightBreakdowns.delete(cacheKey);
            }
        };

        // Reuse in-flight promise if another instance requested the same item
        let p = inFlightBreakdowns.get(cacheKey);
        if (!p) {
            p = new Promise<number>((resolve) => {
                enqueueTask(async () => {
                    const result = await executeFetch();
                    resolve(result);
                });
            });
            inFlightBreakdowns.set(cacheKey, p);
        }

        p.then(count => {
            if (isMounted) setTotal(count);
        });

        return () => { isMounted = false; };
    }, [db, equipmentId, equipmentName, currentYear]);

    if (total === null) return <span className="text-muted-foreground text-xs font-mono opacity-50">-</span>;
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
    
    // Check in-memory cache synchronously on first render
    const cachedCount = maintenanceCache.get(equipmentId) ?? maintenanceCache.get(equipmentName);
    const [total, setTotal] = useState<number | null>(cachedCount !== undefined ? cachedCount : null);

    useEffect(() => {
        if (!equipmentId && !equipmentName) return;

        // Already cached? Nothing to do!
        const existing = maintenanceCache.get(equipmentId) ?? maintenanceCache.get(equipmentName);
        if (existing !== undefined) {
            setTotal(existing);
            return;
        }

        let isMounted = true;
        const cacheKey = equipmentId || equipmentName;

        const executeFetch = async (): Promise<number> => {
            try {
                const queries = [];
                if (equipmentId) {
                    queries.push(getDocs(query(collection(db, 'completed_schedules'), where('equipmentId', '==', equipmentId))));
                }
                if (equipmentName && equipmentName !== equipmentId) {
                    queries.push(getDocs(query(collection(db, 'completed_schedules'), where('equipmentName', '==', equipmentName))));
                }

                const snaps = await Promise.all(queries);
                let count = 0;
                const uniqueIds = new Set<string>();

                snaps.forEach(snap => {
                    snap.forEach(doc => {
                        const data = doc.data();
                        if (data.completionDate && data.completionDate.startsWith(currentYear) && !uniqueIds.has(doc.id)) {
                            count++;
                            uniqueIds.add(doc.id);
                        }
                    });
                });

                if (equipmentId) maintenanceCache.set(equipmentId, count);
                if (equipmentName) maintenanceCache.set(equipmentName, count);

                return count;
            } catch (e) {
                console.error("Failed to fetch maintenance tally", e);
                return 0;
            } finally {
                inFlightMaintenance.delete(cacheKey);
            }
        };

        // Reuse in-flight promise if another instance requested the same item
        let p = inFlightMaintenance.get(cacheKey);
        if (!p) {
            p = new Promise<number>((resolve) => {
                enqueueTask(async () => {
                    const result = await executeFetch();
                    resolve(result);
                });
            });
            inFlightMaintenance.set(cacheKey, p);
        }

        p.then(count => {
            if (isMounted) setTotal(count);
        });

        return () => { isMounted = false; };
    }, [db, equipmentId, equipmentName, currentYear]);

    if (total === null) return <span className="text-muted-foreground text-xs font-mono opacity-50">-</span>;
    if (total === 0) return <span className="text-muted-foreground text-xs font-mono">-</span>;

    return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono px-2 py-0.5 shadow-sm text-[10px]">
            {total}
        </Badge>
    );
}
