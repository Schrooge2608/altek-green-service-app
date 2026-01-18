
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
    {
        name: 'Elliot Blower 1',
        location: '3,3KV Blowers',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'Rubicon Perfect Harmony',
        serialNumber: 'TBD-R-BLOWER-1',
        installationDate: todayFormatted,
    },
    {
        name: 'Elliot Blower 2',
        location: '3,3KV Blowers',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'Rubicon Perfect Harmony',
        serialNumber: 'TBD-R-BLOWER-2',
        installationDate: todayFormatted,
    },
    {
        name: 'Elliot Blower 3',
        location: '3,3KV Blowers',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'Rubicon Perfect Harmony',
        serialNumber: 'TBD-R-BLOWER-3',
        installationDate: todayFormatted,
    },
];
