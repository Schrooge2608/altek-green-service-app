
'use client';

import type { MaintenanceTask, User } from '@/lib/types';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, User as UserIcon } from 'lucide-react';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import React from 'react';

interface MaintenanceScheduleProps {
  tasks: MaintenanceTask[] | null;
  isLoading: boolean;
  frequency: MaintenanceTask['frequency'];
}

type StatusVariant = "default" | "secondary" | "destructive";

const statusVariantMap: Record<string, StatusVariant> = {
  completed: 'default',
  pending: 'secondary',
  overdue: 'destructive',
};

// A helper function to get the correct path slug for the URL
function getFrequencySlug(frequency: MaintenanceTask['frequency']): string {
    return frequency.toLowerCase().replace(/\s+/g, '-');
}

function AssigneeManager({ task }: { task: MaintenanceTask }) {
    const firestore = useFirestore();
    const { user } = useUser();
    
    const userRoleRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userRole, isLoading: userRoleLoading } = useDoc<User>(userRoleRef);
    
    const isSupervisor = userRole?.role === 'Site Supervisor' || userRole?.role === 'Services Manager' || userRole?.role === 'Corporate Manager' || userRole?.role === 'Admin';
    
    const techniciansQuery = useMemoFirebase(() => {
        // Only fetch technicians if the current user is a supervisor and logged in
        if (!user || !isSupervisor) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'Technician'));
    }, [firestore, user, isSupervisor]);
    const { data: technicians, isLoading: techniciansLoading } = useCollection<User>(techniciansQuery);

    const handleAssign = (userId: string) => {
        if (userId === 'unassigned') {
             const taskRef = doc(firestore, 'tasks', task.id);
             updateDocumentNonBlocking(taskRef, {
                assignedToId: '',
                assignedToName: '',
            });
            return;
        }

        const selectedTech = technicians?.find(t => t.id === userId);
        if (selectedTech) {
            const taskRef = doc(firestore, 'tasks', task.id);
            // This is a temporary "fix" for generated tasks that don't exist in firestore yet.
            // A proper solution would be to save generated tasks to firestore first.
            // For now, we will update the document, which will fail silently if it does not exist.
            updateDocumentNonBlocking(taskRef, {
                assignedToId: selectedTech.id,
                assignedToName: selectedTech.name,
            });
        }
    };

    if (!user || !isSupervisor || userRoleLoading) {
        return (
            <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span>{task.assignedToName || 'Unassigned'}</span>
            </div>
        );
    }
    
    return (
        <Select onValueChange={handleAssign} value={task.assignedToId || 'unassigned'} disabled={techniciansLoading}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Assign to..." />
            </SelectTrigger>
            <SelectContent>
                {techniciansLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                    <>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {technicians?.map(tech => (
                            <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                        ))}
                    </>
                )}
            </SelectContent>
        </Select>
    );
}

export function MaintenanceSchedule({ tasks, isLoading, frequency }: MaintenanceScheduleProps) {
  
  if (isLoading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Loading {frequency.toLowerCase()} tasks...
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
        <div className="text-center py-20 text-muted-foreground">
            <h3 className="text-lg font-semibold">No {frequency.toLowerCase()} tasks due.</h3>
            <p className="text-sm">All equipment is up to date for this maintenance cycle.</p>
        </div>
    );
  }


  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]"></TableHead>
          <TableHead>Equipment</TableHead>
          <TableHead>Task</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell>
              <Checkbox aria-label={`Mark task ${task.id} as complete`} disabled={task.status === 'completed'} checked={task.status === 'completed'}/>
            </TableCell>
            <TableCell className="font-medium">{task.equipmentName}</TableCell>
            <TableCell>{task.task}</TableCell>
            <TableCell>{task.dueDate}</TableCell>
            <TableCell>
              <Badge variant={statusVariantMap[task.status]}>
                {task.status}
              </Badge>
            </TableCell>
            <TableCell>
                <AssigneeManager task={task} />
            </TableCell>
            <TableCell className="text-right">
                <Link href={`/maintenance-docs/${task.id}`} passHref>
                  <Button variant="ghost" size="icon">
                    <FileText className="h-4 w-4" />
                    <span className="sr-only">Generate Document</span>
                  </Button>
                </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
