
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
    {
        name: 'Disposal pump 16 VSD',
        plant: 'Smelter',
        division: 'MSP',
        location: 'RWPH',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        uptime: 100,
        powerConsumption: 0,
        model: 'Sinamics G150',
        serialNumber: 'N/A',
        installationDate: todayFormatted,
    },
    {
        name: 'Disposal pump 17 VSD',
        plant: 'Smelter',
        division: 'MSP',
        location: 'RWPH',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        uptime: 100,
        powerConsumption: 0,
        model: 'Sinamics G150',
        serialNumber: 'N/A',
        installationDate: todayFormatted,
    },
];
