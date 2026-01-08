
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
import { FileText, User as UserIcon } from 'lucide-react';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import React from 'react';
import { MaintenanceCategory } from '@/lib/task-generator';

interface MaintenanceScheduleProps {
  tasks: MaintenanceTask[] | null;
  isLoading: boolean;
  category: MaintenanceCategory;
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
        if (!user || !isSupervisor) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'Technician'));
    }, [firestore, user, isSupervisor]);
    const { data: technicians, isLoading: techniciansLoading } = useCollection<User>(techniciansQuery);

    const handleAssign = (userId: string) => {
        const taskRef = doc(firestore, 'tasks', task.id);
        const dataToSet: Partial<MaintenanceTask> = {
            ...task, // Pass the full existing task data
        };
        
        if (userId === 'unassigned') {
            dataToSet.assignedToId = '';
            dataToSet.assignedToName = '';
        } else {
            const selectedTech = technicians?.find(t => t.id === userId);
            if (selectedTech) {
                dataToSet.assignedToId = selectedTech.id;
                dataToSet.assignedToName = selectedTech.name;
            }
        }
        setDocumentNonBlocking(taskRef, dataToSet, { merge: true });
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

export function MaintenanceSchedule({ tasks, isLoading, category }: MaintenanceScheduleProps) {
  
  if (isLoading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Loading {category.toLowerCase()} tasks...
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
        <div className="text-center py-20 text-muted-foreground">
            <h3 className="text-lg font-semibold">No {category.toLowerCase()} tasks due.</h3>
            <p className="text-sm">All equipment is up to date for this maintenance cycle.</p>
        </div>
    );
  }

  const categorySlug = category.toLowerCase();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Equipment</TableHead>
          <TableHead>Component</TableHead>
          <TableHead>Task</TableHead>
          <TableHead>Frequency</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="font-medium">
                <Link href={`/equipment/${task.equipmentId}`} className="hover:underline text-primary">
                    {task.equipmentName}
                </Link>
            </TableCell>
            <TableCell>{task.component}</TableCell>
            <TableCell>{task.task}</TableCell>
            <TableCell>
                <Badge variant="secondary">{task.frequency}</Badge>
            </TableCell>
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
                <Link href={`/maintenance/${categorySlug}/${getFrequencySlug(task.frequency)}`} passHref>
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
