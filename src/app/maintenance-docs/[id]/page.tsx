'use client';

import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { AltekLogo } from '@/components/altek-logo';
import { useEffect } from 'react';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { MaintenanceTask, Equipment } from '@/lib/types';

export default function MaintenanceDocumentPage({ params }: { params: { id: string } }) {
  const firestore = useFirestore();

  const taskRef = useMemoFirebase(() => doc(firestore, 'tasks', params.id), [firestore, params.id]);
  const { data: task, isLoading: taskLoading, error: taskError } = useDoc<MaintenanceTask>(taskRef);

  const eqRef = useMemoFirebase(() => (task ? doc(firestore, 'equipment', task.equipmentId) : null), [firestore, task]);
  const { data: eq, isLoading: eqLoading } = useDoc<Equipment>(eqRef);
  
  useEffect(() => {
    if (!taskLoading && !task) {
      notFound();
    }
  }, [task, taskLoading]);

  if (taskLoading || eqLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <p>Loading document...</p>
        </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 print-container">
        <div className="flex justify-end mb-4 gap-2 print:hidden">
            <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
        </div>

        <Card className="p-8 shadow-lg border-2 border-primary/20 bg-card print-card">
            <header className="flex items-start justify-between mb-8">
                <div>
                    <AltekLogo className="h-12 w-auto" />
                    <p className="text-muted-foreground mt-2">VSD & Equipment Services</p>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-primary">Maintenance Work Order</h2>
                    <p className="text-muted-foreground">WO-{task.id.toUpperCase()}</p>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                <div>
                    <h3 className="font-semibold text-muted-foreground mb-2">CUSTOMER</h3>
                    <p className="font-medium">Customer Name Placeholder</p>
                    <p>123 Industrial Park</p>
                    <p>Factory City, 12345</p>
                </div>
                 <div>
                    <h3 className="font-semibold text-muted-foreground mb-2">EQUIPMENT DETAILS</h3>
                    <p><strong>ID:</strong> {eq?.id || 'N/A'}</p>
                    <p><strong>Name:</strong> {eq?.name || 'N/A'}</p>
                    <p><strong>Location:</strong> {eq?.location || 'N/A'}</p>
                </div>
            </div>

            <Separator className="my-8" />
            
            <h3 className="text-xl font-bold mb-4">Scheduled Task</h3>

            <Card className="bg-secondary/30">
                <div className="p-6">
                    <h4 className="font-bold text-lg">{task.task}</h4>
                    <p className="text-muted-foreground mt-2">
                        This task is part of the <strong>{task.frequency}</strong> maintenance schedule for the specified equipment.
                    </p>
                    <p className="mt-4"><strong>Due Date:</strong> {task.dueDate}</p>
                </div>
            </Card>

            <div className="mt-12">
                <h3 className="font-semibold text-muted-foreground mb-2">TECHNICIAN NOTES</h3>
                <div className="border-dashed border-2 rounded-lg p-4 h-40 bg-background">
                </div>
            </div>

            <footer className="mt-16 text-xs text-muted-foreground grid grid-cols-2 gap-4">
                <div>
                    <p><strong>Technician Signature:</strong> _________________________</p>
                </div>
                <div className="text-right">
                     <p><strong>Date Completed:</strong> _________________________</p>
                </div>
            </footer>
        </Card>
    </div>
  );
}
