
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
    DialogClose
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Save, Loader2, CalendarIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Equipment, VSD, MaintenanceTask, ScheduledTask, User } from '@/lib/types';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useFirestore, useUser, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection } from 'firebase/firestore';


interface CreateUnscheduledScheduleDialogProps {
    equipment: Equipment;
    vsd: VSD | null;
}

const availableFrequencies: Record<string, MaintenanceTask['frequency'][]> = {
    'VSD': ['Weekly', 'Monthly', '3-Monthly', '6-Monthly', 'Yearly'],
    'Protection': ['6-Monthly'],
    'Motor': [],
    'Pump': [],
    'UPS': [],
};

export function CreateUnscheduledScheduleDialog({ equipment, vsd }: CreateUnscheduledScheduleDialogProps) {
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();

    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedComponent, setSelectedComponent] = useState<MaintenanceTask['component'] | ''>('');
    const [selectedFrequency, setSelectedFrequency] = useState<MaintenanceTask['frequency'] | ''>('');
    const [scheduledForDate, setScheduledForDate] = useState<Date | undefined>();
    const [assignedToId, setAssignedToId] = useState<string | undefined>();
    
    const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);


    const componentOptions = useMemo(() => {
        const options: { value: MaintenanceTask['component']; label: string }[] = [];
        if (vsd?.model) options.push({ value: 'VSD', label: 'VSD / Soft Starter' });
        if (equipment.breakerAssetNumber) options.push({ value: 'Protection', label: 'Protection System' });
        // Add other components here if they get schedule pages
        return options;
    }, [equipment, vsd]);

    const frequencyOptions = selectedComponent ? availableFrequencies[selectedComponent as keyof typeof availableFrequencies] || [] : [];

    const handleCreateSchedule = async () => {
        if (!selectedComponent || !selectedFrequency || !scheduledForDate || !assignedToId) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill out all fields.' });
            return;
        }

        const assignedUser = users?.find(u => u.id === assignedToId);
        if (!assignedUser) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find selected technician.' });
            return;
        }

        setIsSaving(true);
        
        const taskTitle = `${selectedComponent} ${selectedFrequency} Service`;

        const newScheduledTask: Omit<ScheduledTask, 'id' | 'completionNotes'> = {
            originalTaskId: `${equipment.id}-${selectedComponent.toLowerCase()}-${selectedFrequency.toLowerCase()}-unscheduled`,
            equipmentId: equipment.id,
            equipmentName: equipment.name,
            task: taskTitle,
            scheduledFor: format(scheduledForDate, 'yyyy-MM-dd'),
            status: 'Pending',
            assignedToId: assignedUser.id,
            assignedToName: assignedUser.name,
            component: selectedComponent,
            frequency: selectedFrequency as MaintenanceTask['frequency'],
        };
        
        try {
            const schedulesRef = collection(firestore, 'upcoming_schedules');
            await addDocumentNonBlocking(schedulesRef, newScheduledTask);
            toast({
                title: 'Schedule Created',
                description: `A new task for ${equipment.name} has been added to the upcoming schedule.`
            });
            setIsOpen(false);
            router.push('/maintenance/upcoming-schedules');
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message || 'Could not save the schedule.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Schedule for Unscheduled Work
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Unscheduled Work Schedule</DialogTitle>
                    <DialogDescription>
                        Select a component and frequency, then assign a technician and date to create a new task in the upcoming schedule.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="component-select">Component</Label>
                        <Select onValueChange={(value) => setSelectedComponent(value as MaintenanceTask['component'])} value={selectedComponent}>
                            <SelectTrigger id="component-select">
                                <SelectValue placeholder="Select a component..." />
                            </SelectTrigger>
                            <SelectContent>
                                {componentOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedComponent && (
                         <div className="space-y-2">
                            <Label htmlFor="frequency-select">Frequency</Label>
                            <Select onValueChange={(value) => setSelectedFrequency(value as MaintenanceTask['frequency'])} value={selectedFrequency} disabled={frequencyOptions.length === 0}>
                                <SelectTrigger id="frequency-select">
                                    <SelectValue placeholder="Select a frequency..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {frequencyOptions.length > 0 ? (
                                        frequencyOptions.map(freq => (
                                            <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="none" disabled>No schedules for this component</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !scheduledForDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {scheduledForDate ? format(scheduledForDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={scheduledForDate} onSelect={setScheduledForDate} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="assigned-to-select">Assign To</Label>
                         <Select onValueChange={setAssignedToId} value={assignedToId} disabled={usersLoading}>
                            <SelectTrigger id="assigned-to-select">
                                <SelectValue placeholder="Select technician..." />
                            </SelectTrigger>
                            <SelectContent>
                            {usersLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : (
                                users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)
                            )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleCreateSchedule} disabled={isSaving || !selectedComponent || !selectedFrequency || !scheduledForDate || !assignedToId}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isSaving ? 'Saving...' : 'Create Schedule'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
