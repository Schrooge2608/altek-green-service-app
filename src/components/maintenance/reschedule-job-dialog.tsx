'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2, Save, History } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ScheduledTask, User } from '@/lib/types';

interface RescheduleJobDialogProps {
  schedule: ScheduledTask;
}

export function RescheduleJobDialog({ schedule }: RescheduleJobDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State initialized from current schedule
  const [newDate, setNewDate] = useState<Date | undefined>(
    schedule.scheduledFor ? new Date(schedule.scheduledFor) : new Date()
  );
  const [newAssignedToId, setNewAssignedToId] = useState(schedule.assignedToId);

  // Fetch users for re-assignment
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const currentUserData = useMemo(() => {
    if (!user || !allUsers) return null;
    return allUsers.find(u => u.id === user.uid);
  }, [user, allUsers]);

  const isAdminOrManager = useMemo(() => {
    if (!currentUserData) return false;
    const managementRoles = ['Admin', 'Superadmin', 'Client Manager', 'Corporate Manager', 'Services Manager', 'Site Supervisor'];
    return managementRoles.includes(currentUserData.role);
  }, [currentUserData]);

  const technicians = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.role?.includes('Technician') || 
      u.role?.includes('Engineer') || 
      u.role?.includes('Technologist') ||
      u.role?.includes('specialist')
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsers]);

  const handleReschedule = async () => {
    if (!newDate || !newAssignedToId) {
      toast({ variant: 'destructive', title: "Incomplete Form", description: "Please select both a date and a technician." });
      return;
    }

    setIsSaving(true);
    try {
      const selectedTech = technicians.find(t => t.id === newAssignedToId);
      const scheduleRef = doc(firestore, 'upcoming_schedules', schedule.id);
      
      await updateDoc(scheduleRef, {
        scheduledFor: format(newDate, 'yyyy-MM-dd'),
        assignedToId: newAssignedToId,
        assignedToName: selectedTech?.name || 'Unknown',
        updatedAt: new Date().toISOString()
      });

      toast({ title: "Job Rescheduled", description: `Task moved to ${format(newDate, 'PPP')} and assigned to ${selectedTech?.name}.` });
      setIsOpen(false);
    } catch (error: any) {
      console.error("Reschedule Error:", error);
      toast({ variant: 'destructive', title: "Update Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Only render the button for Admins and Managers
  if (!isAdminOrManager) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-amber-500 text-amber-700 hover:bg-amber-50">
          <History className="mr-2 h-4 w-4" />
          Reschedule Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reschedule Maintenance Job</DialogTitle>
          <DialogDescription>
            Modify the target completion date or reassign this task to another team member.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500">New Target Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal border-slate-300",
                    !newDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {newDate ? format(newDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={setNewDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-slate-500">Reassign Technician</Label>
            <Select value={newAssignedToId} onValueChange={setNewAssignedToId}>
              <SelectTrigger className="border-slate-300">
                <SelectValue placeholder="Select technician..." />
              </SelectTrigger>
              <SelectContent>
                {technicians.map(tech => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.name} ({tech.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleReschedule} disabled={isSaving || !newDate} className="bg-amber-600 hover:bg-amber-700">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Confirm Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
