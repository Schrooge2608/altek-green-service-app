'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { MaintenanceSchedule } from '@/components/maintenance-schedule';
import type { MaintenanceTask } from '@/lib/types';

export default function MaintenancePage() {
  const firestore = useFirestore();

  const weeklyTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('frequency', '==', 'Weekly')), [firestore]);
  const monthlyTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('frequency', '==', 'Monthly')), [firestore]);
  const quarterlyTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('frequency', '==', '3-Monthly')), [firestore]);

  const { data: weeklyTasks, isLoading: weeklyLoading } = useCollection<MaintenanceTask>(weeklyTasksQuery);
  const { data: monthlyTasks, isLoading: monthlyLoading } = useCollection<MaintenanceTask>(monthlyTasksQuery);
  const { data: quarterlyTasks, isLoading: quarterlyLoading } = useCollection<MaintenanceTask>(quarterlyTasksQuery);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Schedule</h1>
        <p className="text-muted-foreground">
          Generate and view maintenance tasks for all equipment.
        </p>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="weekly">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly">3-Monthly</TabsTrigger>
            </TabsList>
            <TabsContent value="weekly">
              <MaintenanceSchedule title="Weekly Tasks" tasks={weeklyTasks} isLoading={weeklyLoading} />
            </TabsContent>
            <TabsContent value="monthly">
              <MaintenanceSchedule title="Monthly Tasks" tasks={monthlyTasks} isLoading={monthlyLoading} />
            </TabsContent>
            <TabsContent value="quarterly">
              <MaintenanceSchedule title="3-Monthly Tasks" tasks={quarterlyTasks} isLoading={quarterlyLoading} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
