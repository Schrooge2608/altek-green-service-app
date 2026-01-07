
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
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

export default function MaintenancePage() {
  const firestore = useFirestore();

  const weeklyTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('frequency', '==', 'Weekly')), [firestore]);
  const monthlyTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('frequency', '==', 'Monthly')), [firestore]);
  const quarterlyTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('frequency', '==', '3-Monthly')), [firestore]);
  const sixMonthlyTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('frequency', '==', '6-Monthly')), [firestore]);
  const yearlyTasksQuery = useMemoFirebase(() => query(collection(firestore, 'tasks'), where('frequency', '==', 'Yearly')), [firestore]);


  const { data: weeklyTasks, isLoading: weeklyLoading } = useCollection<MaintenanceTask>(weeklyTasksQuery);
  const { data: monthlyTasks, isLoading: monthlyLoading } = useCollection<MaintenanceTask>(monthlyTasksQuery);
  const { data: quarterlyTasks, isLoading: quarterlyLoading } = useCollection<MaintenanceTask>(quarterlyTasksQuery);
  const { data: sixMonthlyTasks, isLoading: sixMonthlyLoading } = useCollection<MaintenanceTask>(sixMonthlyTasksQuery);
  const { data: yearlyTasks, isLoading: yearlyLoading } = useCollection<MaintenanceTask>(yearlyTasksQuery);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Maintenance Schedule</h1>
            <p className="text-muted-foreground">
            Generate and view maintenance tasks for all equipment.
            </p>
        </div>
        <Link href="/maintenance/service-scopes" passHref>
            <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                View Service Scopes
            </Button>
        </Link>
      </header>
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="weekly">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly">3-Monthly</TabsTrigger>
              <TabsTrigger value="6-monthly">6-Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
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
            <TabsContent value="6-monthly">
              <MaintenanceSchedule title="6-Monthly Tasks" tasks={sixMonthlyTasks} isLoading={sixMonthlyLoading} />
            </TabsContent>
            <TabsContent value="yearly">
              <MaintenanceSchedule title="Yearly Tasks" tasks={yearlyTasks} isLoading={yearlyLoading} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
