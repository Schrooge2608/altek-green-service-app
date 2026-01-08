
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MaintenanceSchedule } from '@/components/maintenance-schedule';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment, MaintenanceTask } from '@/lib/types';
import { generateTasksForEquipment } from '@/lib/task-generator';

const frequencies: MaintenanceTask['frequency'][] = [
  'Weekly',
  'Monthly',
  '3-Monthly',
  '6-Monthly',
  'Yearly',
];

export default function MaintenancePage() {
  const firestore = useFirestore();
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const allTasks = useMemo(() => {
    if (!equipment) return [];
    return equipment.flatMap(eq => generateTasksForEquipment(eq));
  }, [equipment]);

  const tasksByFrequency = useMemo(() => {
    return frequencies.reduce((acc, freq) => {
      acc[freq] = allTasks.filter(task => task.frequency === freq);
      return acc;
    }, {} as Record<MaintenanceTask['frequency'], MaintenanceTask[]>);
  }, [allTasks]);


  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Schedule</h1>
        <p className="text-muted-foreground">
          Automatically generated maintenance tasks for all equipment.
        </p>
      </header>

      {equipmentLoading ? (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-2">Generating maintenance tasks...</p>
        </div>
      ) : (
        <Tabs defaultValue="Weekly" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {frequencies.map(freq => (
              <TabsTrigger key={freq} value={freq}>{freq}</TabsTrigger>
            ))}
          </TabsList>
          {frequencies.map(freq => (
            <TabsContent key={freq} value={freq}>
              <Card>
                <CardContent className="pt-6">
                  <MaintenanceSchedule
                    tasks={tasksByFrequency[freq]}
                    isLoading={equipmentLoading}
                    frequency={freq}
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
