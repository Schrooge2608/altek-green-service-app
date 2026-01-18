
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
    {
        name: 'Cone Settler Pump',
        plant: 'Smelter',
        division: 'MSP',
        location: 'MSP - CONE SETTLER',
        model: 'Siemens Micromaster 440',
        serialNumber: 'N/A',
        installationDate: todayFormatted,
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        powerConsumption: 0,
        uptime: 100,
        totalDowntimeHours: 0,
    }
];
