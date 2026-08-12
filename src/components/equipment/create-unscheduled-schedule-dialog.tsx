'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useFirebase, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Equipment, VSD } from '@/lib/types';

export function CreateUnscheduledScheduleDialog({ equipment, vsd }: { equipment: Equipment, vsd?: VSD | null }) {
  const [isSaving, setIsSaving] = useState(false);
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, 'upcoming_schedules'), {
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        task: 'Unscheduled Maintenance',
        status: 'Pending',
        assignedToId: user.uid,
        assignedToName: user.displayName || 'Technician',
        scheduledFor: format(new Date(), 'yyyy-MM-dd'),
        component: 'VSD',
        frequency: 'Weekly',
        originalTaskId: `manual-${Date.now()}`,
        createdAt: serverTimestamp()
      });
      toast({ title: "Created", description: "Unscheduled task added to your list." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleCreate} disabled={isSaving}>
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
      Add to Schedule
    </Button>
  );
}
