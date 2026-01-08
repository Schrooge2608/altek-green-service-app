
'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaintenanceSchedule } from '@/components/maintenance-schedule';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment, MaintenanceTask } from '@/lib/types';
import { generateTasksForEquipment, MaintenanceCategory } from '@/lib/task-generator';

const maintenanceCategories: MaintenanceCategory[] = [
  'VSDs',
  'Protection',
  'Motors',
  'Pumps',
];

export default function MaintenancePage() {
  const firestore = useFirestore();
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);
  const [activeTab, setActiveTab] = useState<MaintenanceCategory>('VSDs');

  const allTasks = useMemo(() => {
    if (!equipment) return [];
    return equipment.flatMap(eq => generateTasksForEquipment(eq));
  }, [equipment]);

  const tasksByCategory = useMemo(() => {
    return maintenanceCategories.reduce((acc, category) => {
      acc[category] = allTasks.filter(task => task.component === category.slice(0, -1)); // 'VSDs' -> 'VSD'
      return acc;
    }, {} as Record<MaintenanceCategory, MaintenanceTask[]>);
  }, [allTasks]);


  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Schedule</h1>
        <p className="text-muted-foreground">
          Automatically generated maintenance tasks for all equipment, sorted by component type.
        </p>
      </header>

      {equipmentLoading ? (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-2">Generating maintenance tasks...</p>
        </div>
      ) : (
        <Tabs defaultValue="VSDs" className="w-full" onValueChange={(value) => setActiveTab(value as MaintenanceCategory)}>
          <TabsList className="grid w-full grid-cols-4">
            {maintenanceCategories.map(cat => (
              <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
            ))}
          </TabsList>
          {maintenanceCategories.map(cat => (
            <TabsContent key={cat} value={cat}>
              <Card>
                <CardContent className="pt-6">
                  <MaintenanceSchedule
                    tasks={tasksByCategory[cat]}
                    isLoading={equipmentLoading}
                    category={cat}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
