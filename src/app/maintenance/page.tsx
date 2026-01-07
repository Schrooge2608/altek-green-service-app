
'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { MaintenanceSchedule } from '@/components/maintenance-schedule';
import type { MaintenanceTask } from '@/lib/types';
import { Button } from '@/components/ui/button';

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

  const serviceScopes = [
    { title: 'Weekly Service Scope', frequency: 'Weekly' },
    { title: 'Monthly Service Scope', frequency: 'Monthly' },
    { title: '3-Monthly Service Scope', frequency: '3-Monthly' },
    { title: '6-Monthly Service Scope', frequency: '6-Monthly' },
    { title: 'Yearly Service Scope', frequency: 'Yearly' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Maintenance Schedule</h1>
            <p className="text-muted-foreground">
            Generate and view maintenance tasks for all equipment.
            </p>
        </div>
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
              <MaintenanceSchedule tasks={weeklyTasks} isLoading={weeklyLoading} frequency="Weekly"/>
            </TabsContent>
            <TabsContent value="monthly">
              <MaintenanceSchedule tasks={monthlyTasks} isLoading={monthlyLoading} frequency="Monthly"/>
            </TabsContent>
            <TabsContent value="quarterly">
              <MaintenanceSchedule tasks={quarterlyTasks} isLoading={quarterlyLoading} frequency="3-Monthly"/>
            </TabsContent>
            <TabsContent value="6-monthly">
              <MaintenanceSchedule tasks={sixMonthlyTasks} isLoading={sixMonthlyLoading} frequency="6-Monthly"/>
            </TabsContent>
            <TabsContent value="yearly">
              <MaintenanceSchedule tasks={yearlyTasks} isLoading={yearlyLoading} frequency="Yearly"/>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {serviceScopes.map(scope => (
             <Card key={scope.frequency}>
                <CardHeader>
                    <CardTitle className="text-lg">{scope.title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button disabled className="w-full">
                        View Service Scope
                    </Button>
                </CardContent>
            </Card>
        ))}
      </div>
    </div>
  );
}
