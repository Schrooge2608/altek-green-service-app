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
import { Activity, AlertTriangle, Cpu, Zap } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { PerformanceChart } from '@/components/performance-chart';
import { collection, query, where, limit } from 'firebase/firestore';
import type { VSD, Equipment, MaintenanceTask } from '@/lib/types';

export default function Home() {
  const firestore = useFirestore();

  const vsdsQuery = useMemoFirebase(() => collection(firestore, 'vsds'), [firestore]);
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const maintenanceTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('status', '==', 'pending'), limit(5)), [firestore]);

  const { data: vsds, isLoading: vsdsLoading } = useCollection<VSD>(vsdsQuery);
  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);
  const { data: maintenanceTasks, isLoading: tasksLoading } = useCollection<MaintenanceTask>(maintenanceTasksQuery);

  const activeVSDs = vsds?.filter((vsd) => vsd.status === 'active').length ?? 0;
  const criticalAlerts = equipment?.filter(
    (eq) => eq.uptime < 98
  ).length ?? 0;
  const avgPowerConsumption = equipment
    ? equipment.reduce((acc, eq) => acc + eq.powerConsumption, 0) /
      equipment.length /
      1000
    : 0;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the Altek Green VSD Data Base.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total VSDs</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vsdsLoading ? '...' : vsds?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {activeVSDs} active units
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Equipment Monitored
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipmentLoading ? '...' : equipment?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Pumps, Fans, Compressors
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg. Power Consumption
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {equipmentLoading ? '...' : avgPowerConsumption.toFixed(2)}{' '}
              MWh
            </div>
            <p className="text-xs text-muted-foreground">Total across all units</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{equipmentLoading ? '...' : criticalAlerts}</div>
            <p className="text-xs text-muted-foreground">
              Requiring immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Overall Equipment Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <PerformanceChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Due Date</TableHead>
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
    </div>
  );
}
