'use client';
import React, { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { fetchAllStatsForYear, getStatsForEquipment } from './EquipmentStatsCache';

export function BreakdownTally({ equipmentId, equipmentName }: { equipmentId: string, equipmentName: string }) {
    const db = useFirestore();
    const currentYear = new Date().getFullYear().toString();
    const [total, setTotal] = useState<number | null>(null);

    useEffect(() => {
        if (!equipmentId || !equipmentName) return;
        fetchAllStatsForYear(db, currentYear).then(data => {
            const stats = getStatsForEquipment(data, equipmentId, equipmentName);
            setTotal(stats.breakdowns);
        }).catch(err => {
            console.error("Failed to fetch breakdown tally", err);
            setTotal(0);
        });
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
        fetchAllStatsForYear(db, currentYear).then(data => {
            const stats = getStatsForEquipment(data, equipmentId, equipmentName);
            setTotal(stats.maintenance);
        }).catch(err => {
            console.error("Failed to fetch maintenance tally", err);
            setTotal(0);
        });
    }, [db, equipmentId, equipmentName, currentYear]);

    if (total === null) return <span className="text-muted-foreground text-xs font-mono opacity-50">...</span>;
    if (total === 0) return <span className="text-muted-foreground text-xs font-mono">-</span>;

    return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono px-2 py-0.5 shadow-sm text-[10px]">
            {total}
        </Badge>
    );
}
