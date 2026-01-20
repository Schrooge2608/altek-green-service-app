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

export default function MaintenancePage() {
  const firestore = useFirestore();
  const equipmentQuery = useMemoFirebase(() => collection(firestore, 'equipment'), [firestore]);
  const { data: equipment, isLoading: equipmentLoading } = useCollection<Equipment>(equipmentQuery);

  const tasksByPlantAndDivision = useMemo(() => {
    if (!equipment) return {};
    
    const grouped: Record<string, Record<string, MaintenanceTask[]>> = {
        'Mining': {},
        'Smelter': {},
    };

    equipment.forEach(eq => {
        if (eq.plant && eq.division) {
            const tasks = generateTasksForEquipment(eq);
            if (tasks.length > 0) {
                if (!grouped[eq.plant][eq.division]) {
                    grouped[eq.plant][eq.division] = [];
                }
                grouped[eq.plant][eq.division].push(...tasks);
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
              Object.keys(tasksByPlantAndDivision[plant] || {}).length > 0 && (
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
                            {Object.keys(tasksByPlantAndDivision[plant]).sort().map(division => (
                                tasksByPlantAndDivision[plant][division].length > 0 && (
                                <AccordionItem value={division} key={division} className="border rounded-lg">
                                    <AccordionTrigger className="px-4 py-2 hover:no-underline text-base">
                                        {division} ({tasksByPlantAndDivision[plant][division].length} tasks)
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-1 border-t">
                                            <MaintenanceSchedule
                                                tasks={tasksByPlantAndDivision[plant][division]}
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
                  </Card>
                </AccordionItem>
              )
          ))}
        </Accordion>
      )}
    </div>
  );
}
