'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Equipment, User } from '@/lib/types';

export function AssignTechnicianDropdown({ equipment, users, usersLoading }: { equipment: Equipment, users: User[] | null, usersLoading: boolean }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const handleAssign = async (userId: string) => {
    const selectedUser = users?.find(u => u.id === userId);
    if (!selectedUser) return;

    try {
      await updateDoc(doc(firestore, 'equipment', equipment.id), {
        assignedToId: selectedUser.id,
        assignedToName: selectedUser.name
      });
      toast({ title: "Technician Assigned", description: `${selectedUser.name} is now responsible for ${equipment.name}.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Assignment Failed", description: e.message });
    }
  };

  return (
    <Select 
      disabled={usersLoading} 
      onValueChange={handleAssign} 
      value={equipment.assignedToId || "unassigned"}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue placeholder="Assign Tech..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned" disabled>Select Technician</SelectItem>
        {users?.map(u => (
          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
