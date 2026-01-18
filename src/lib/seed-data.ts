import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
    {
        name: 'Dryer Feed Conveyer',
        plant: 'Smelter',
        division: 'MSP',
        location: 'Pilot Plant',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        assignedToName: 'John Doe',
        model: 'ATV630',
        serialNumber: 'VW3A111',
        installationDate: '2024-04-12',
    },
    {
        name: 'Dryer Blower Fan',
        plant: 'Smelter',
        division: 'MSP',
        location: 'Pilot Plant',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        assignedToName: 'John Doe',
        model: 'ATV630',
        serialNumber: 'VW3A111',
        installationDate: '2024-04-12',
    },
    {
        name: 'Dryer Rotary Valve',
        plant: 'Smelter',
        division: 'MSP',
        location: 'Pilot Plant',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        assignedToName: 'Jane Smith',
        model: 'ATV310',
        serialNumber: 'VW3A111',
        installationDate: '2024-04-12',
    },
    {
        name: 'Dryer Screw Conveyer',
        plant: 'Smelter',
        division: 'MSP',
        location: 'Pilot Plant',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        assignedToName: 'Jane Smith',
        model: 'ATV310',
        serialNumber: 'VW3A111',
        installationDate: '2024-04-12',
    },
];
