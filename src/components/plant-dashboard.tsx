'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Activity, AlertTriangle, Cpu, Zap, Building } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { PerformanceChart } from '@/components/performance-chart';
import { collection, query, where, limit } from 'firebase/firestore';
import type { VSD, Equipment, MaintenanceTask } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

interface PlantDashboardProps {
    plantName: 'Mining' | 'Smelter';
}

export function PlantDashboard({ plantName }: PlantDashboardProps) {
    const firestore = useFirestore();

    const equipmentQuery = useMemoFirebase(() => query(collection(firestore, 'equipment'), where('plant', '==', plantName)), [firestore, plantName]);
    const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);
    
    // We need all VSDs to find the ones associated with the plant's equipment
    const vsdsQuery = useMemoFirebase(() => collection(firestore, 'vsds'), [firestore]);
    const { data: allVsds, isLoading: vsdsLoading } = useCollection<VSD>(vsdsQuery);

    const maintenanceTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('status', '==', 'pending'), limit(5)), [firestore]);
    const { data: maintenanceTasks, isLoading: tasksLoading } = useCollection<MaintenanceTask>(maintenanceTasksQuery);

    const plantVSDs = useMemoFirebase(() => {
        if (!equipment || !allVsds) return [];
        const equipmentIds = equipment.map(e => e.vsdId);
        return allVsds.filter(vsd => equipmentIds.includes(vsd.id));
    }, [equipment, allVsds]);

    const activeVSDs = plantVSDs?.filter((vsd) => vsd.status === 'active').length ?? 0;
    const criticalAlerts = equipment?.filter(
        (eq) => eq.uptime < 98
    ).length ?? 0;
    const avgPowerConsumption = equipment && equipment.length > 0
        ? equipment.reduce((acc, eq) => acc + eq.powerConsumption, 0) /
        equipment.length /
        1000
        : 0;

    const isDataLoading = equipmentLoading || vsdsLoading || tasksLoading;

    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building className="h-6 w-6 text-primary" />
                    {plantName} Plant
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total VSDs</CardTitle>
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                             {isDataLoading ? <Skeleton className="h-6 w-12" /> : <div className="text-2xl font-bold">{plantVSDs?.length ?? 0}</div>}
                             {isDataLoading ? <Skeleton className="h-4 w-20 mt-1" /> : <p className="text-xs text-muted-foreground">{activeVSDs} active units</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Equipment</CardTitle>
                            <Zap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            {isDataLoading ? <Skeleton className="h-6 w-10" /> : <div className="text-2xl font-bold">{equipment?.length ?? 0}</div>}
                            <p className="text-xs text-muted-foreground">
                                Monitored units
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Avg. Power</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                             {isDataLoading ? <Skeleton className="h-6 w-20" /> : <div className="text-2xl font-bold">{avgPowerConsumption.toFixed(2)} MWh</div>}
                             <p className="text-xs text-muted-foreground">Total across plant</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            {isDataLoading ? <Skeleton className="h-6 w-8" /> : <div className="text-2xl font-bold">{criticalAlerts}</div>}
                            <p className="text-xs text-muted-foreground">
                            Critical issues
                            </p>
                        </CardContent>
                    </Card>
                </div>
                 <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base">Equipment Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PerformanceChart plant={plantName} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Upcoming Maintenance</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Equipment</TableHead>
                                    <TableHead>Due</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tasksLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">Loading tasks...</TableCell>
                                    </TableRow>
                                    ) : maintenanceTasks && maintenanceTasks.length > 0 ? (
                                    maintenanceTasks.map((task) => (
                                        <TableRow key={task.id}>
                                        <TableCell>
                                            <div className="font-medium">{task.equipmentName}</div>
                                            <div className="text-sm text-muted-foreground hidden md:inline">{task.task}</div>
                                        </TableCell>
                                        <TableCell>{task.dueDate}</TableCell>
                                        </TableRow>
                                    ))
                                    ) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">No upcoming tasks.</TableCell>
                                    </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                 </div>
            </CardContent>
        </Card>
    )
}
