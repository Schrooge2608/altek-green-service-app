
'use client';

import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Equipment, VSD, MaintenanceTask } from '@/lib/types';
import { Label } from '../ui/label';

interface CreateUnscheduledScheduleDialogProps {
    equipment: Equipment;
    vsd: VSD | null;
}

const componentToCategorySlug = (component: MaintenanceTask['component']): string | null => {
    const map: Record<string, string> = {
        'VSD': 'vsds',
        'Protection': 'protection',
    };
    return map[component] || null;
}

const availableFrequencies: Record<string, MaintenanceTask['frequency'][]> = {
    'VSD': ['Weekly', 'Monthly', '3-Monthly', '6-Monthly', 'Yearly'],
    'Protection': ['6-Monthly'],
    'Motor': [],
    'Pump': [],
    'UPS': [],
};

const getFrequencySlug = (frequency: MaintenanceTask['frequency']): string => {
    return frequency.toLowerCase().replace(/\s+/g, '-');
}

export function CreateUnscheduledScheduleDialog({ equipment, vsd }: CreateUnscheduledScheduleDialogProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedComponent, setSelectedComponent] = useState<MaintenanceTask['component'] | ''>('');
    const [selectedFrequency, setSelectedFrequency] = useState('');

    const componentOptions = useMemo(() => {
        const options: { value: MaintenanceTask['component']; label: string }[] = [];
        if (vsd?.model) options.push({ value: 'VSD', label: 'VSD / Soft Starter' });
        if (equipment.breakerAssetNumber) options.push({ value: 'Protection', label: 'Protection System' });
        // Add other components here if they get schedule pages
        return options;
    }, [equipment, vsd]);

    const frequencyOptions = selectedComponent ? availableFrequencies[selectedComponent as keyof typeof availableFrequencies] || [] : [];

    const handleGenerateSchedule = () => {
        if (!selectedComponent || !selectedFrequency) {
            return;
        }
        const categorySlug = componentToCategorySlug(selectedComponent as MaintenanceTask['component']);
        const frequencySlug = getFrequencySlug(selectedFrequency as MaintenanceTask['frequency']);

        if (categorySlug) {
            router.push(`/maintenance/${categorySlug}/${frequencySlug}`);
            setIsOpen(false);
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
                        Select a component and frequency to generate a maintenance scope document.
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
                            <Select onValueChange={setSelectedFrequency} value={selectedFrequency} disabled={frequencyOptions.length === 0}>
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
                </div>
                <Button onClick={handleGenerateSchedule} disabled={!selectedComponent || !selectedFrequency}>
                    Generate Document
                </Button>
            </DialogContent>
        </Dialog>
    )
}
