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
import { Checkbox } from '@/components/ui/checkbox';
import { FileText } from 'lucide-react';

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

export function MaintenanceSchedule({ tasks, isLoading, frequency }: MaintenanceScheduleProps) {
  
  return (
    <div className="mt-4 space-y-4">
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">
          Loading {frequency.toLowerCase()} tasks...
        </div>
      ) : tasks && tasks.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
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
                <TableCell className="text-right">
                    <Link href={`/maintenance/${task.id}/document`} passHref>
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
      ) : null}
    </div>
  );
}
