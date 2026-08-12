'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Equipment, MaintenanceTask } from '@/lib/types';
import { generateTasksForEquipment } from '@/lib/task-generator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MaintenanceSchedule } from '@/components/maintenance-schedule';

const frequencyOrder: MaintenanceTask['frequency'][] = ['Weekly', 'Monthly', '3-Monthly', '6-Monthly', 'Yearly'];

export default function MaintenancePage() {
  const firestore = useFirestore();
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const tasksByPlantDivisionAndFrequency = useMemo(() => {
    if (!equipment) return {};
    
    const grouped: Record<string, Record<string, Record<string, MaintenanceTask[]>>> = {
        'Mining': {},
        'Smelter': {},
    };

    equipment.forEach(eq => {
        if (eq.plant && eq.division) {
            const tasks = generateTasksForEquipment(eq);
            if (tasks.length > 0) {
                if (!grouped[eq.plant][eq.division]) {
                    grouped[eq.plant][eq.division] = {};
                }
                tasks.forEach(task => {
                    if (!grouped[eq.plant][eq.division][task.frequency]) {
                        grouped[eq.plant][eq.division][task.frequency] = [];
                    }
                    grouped[eq.plant][eq.division][task.frequency].push(task);
                });
            }
        }
    });

    return grouped;
  }, [equipment]);
  
  const plantOrder = ['Mining', 'Smelter'];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Schedule</h1>
        <p className="text-muted-foreground">
          Automatically generated maintenance tasks for all equipment, grouped by plant and division.
        </p>
      </header>

      {equipmentLoading ? (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-2">Generating maintenance tasks...</p>
        </div>
      ) : (
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={plantOrder}>
          {plantOrder.map(plant => (
              Object.keys(tasksByPlantDivisionAndFrequency[plant] || {}).length > 0 && (
                <AccordionItem value={plant} key={plant} className="border-b-0">
                  <Card>
                      <AccordionTrigger className="p-6 text-xl font-bold hover:no-underline">
                          <CardHeader className="p-0">
                            <CardTitle>{plant} Plant</CardTitle>
                          </CardHeader>
                      </AccordionTrigger>
                    <AccordionContent className="p-0">
                      <div className="px-6 pb-6">
                        <Accordion type="multiple" className="space-y-2">
                            {Object.keys(tasksByPlantDivisionAndFrequency[plant]).sort().map(division => {
                                const divisionTasks = tasksByPlantDivisionAndFrequency[plant][division];
                                const totalTasksInDivision = Object.values(divisionTasks).reduce((acc, tasks) => acc + tasks.length, 0);

                                return totalTasksInDivision > 0 && (
                                <AccordionItem value={division} key={division} className="border rounded-lg">
                                    <AccordionTrigger className="px-4 py-2 hover:no-underline text-base">
                                        {division} ({totalTasksInDivision} tasks)
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-2 border-t">
                                            <Accordion type="multiple" className="space-y-1">
                                                {frequencyOrder.map(frequency => (
                                                    divisionTasks[frequency] && divisionTasks[frequency].length > 0 && (
                                                        <AccordionItem value={`${division}-${frequency}`} key={frequency} className="border rounded-md">
                                                            <AccordionTrigger className="px-3 py-1.5 hover:no-underline text-sm">
                                                                {frequency} ({divisionTasks[frequency].length} tasks)
                                                            </AccordionTrigger>
                                                            <AccordionContent>
                                                                <div className="p-1 border-t">
                                                                    <MaintenanceSchedule
                                                                        tasks={divisionTasks[frequency]}
                                                                        isLoading={equipmentLoading}
                                                                    />
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    )
                                                ))}
                                            </Accordion>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                )
                            })}
                        </Accordion>
                      </div>
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              )
          ))}
        </Accordion>
      )}
    </div>
  );
}
