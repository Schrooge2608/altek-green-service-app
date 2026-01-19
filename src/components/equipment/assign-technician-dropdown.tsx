'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Equipment, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AssignTechnicianDropdownProps {
    equipment: Equipment;
    users: User[] | null;
    usersLoading: boolean;
}

export function AssignTechnicianDropdown({ equipment, users, usersLoading }: AssignTechnicianDropdownProps) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleAssignmentChange = (newUserId: string) => {
        if (!equipment.id) return;

        const equipmentRef = doc(firestore, 'equipment', equipment.id);
        const vsdRef = doc(firestore, 'vsds', equipment.vsdId);

        const assignedUser = users?.find(u => u.id === newUserId);

        const updateData = {
            assignedToId: newUserId === 'unassigned' ? '' : newUserId,
            assignedToName: newUserId === 'unassigned' ? '' : assignedUser?.name,
        };

        updateDocumentNonBlocking(equipmentRef, updateData);
        // Also update the primary VSD assignment
        updateDocumentNonBlocking(vsdRef, updateData);

        toast({
            title: 'Technician Assigned',
            description: `${assignedUser?.name || 'Nobody'} has been assigned to ${equipment.name}.`,
        });
    };

    if (usersLoading) {
        return (
            <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Loading...</span>
            </div>
        );
    }
    
    return (
        <Select onValueChange={handleAssignmentChange} defaultValue={equipment.assignedToId || 'unassigned'}>
            <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Assign technician..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users?.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.role})
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
