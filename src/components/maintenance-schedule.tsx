
'use client';

import type { MaintenanceTask } from '@/lib/types';
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
import { FileText } from 'lucide-react';
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
                {task.assignedToName || 'Unassigned'}
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
