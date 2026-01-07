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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface MaintenanceScheduleProps {
  title: string;
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

const scopeDocumentMap: Partial<Record<MaintenanceTask['frequency'], string>> = {
    '6-Monthly': '/maintenance/service-scopes/6-monthly',
}

export function MaintenanceSchedule({ title, tasks, isLoading, frequency }: MaintenanceScheduleProps) {
  const scopeDocumentUrl = scopeDocumentMap[frequency];
  
  return (
    <div className="mt-4">
      <div className="flex justify-end mb-4">
        {scopeDocumentUrl ? (
            <Link href={scopeDocumentUrl} passHref>
                <Button variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    View Service Scope
                </Button>
            </Link>
        ) : (
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span tabIndex={0}>
                            <Button variant="outline" disabled>
                                <FileText className="mr-2 h-4 w-4" />
                                View Service Scope
                            </Button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Service scope document not yet available.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}
      </div>
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">
          Loading {title.toLowerCase()}...
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/maintenance/${task.id}/document`} passHref>
                          <Button variant="ghost" size="icon">
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">Generate Document</span>
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Generate Document</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          No tasks for this period.
        </div>
      )}
    </div>
  );
}
