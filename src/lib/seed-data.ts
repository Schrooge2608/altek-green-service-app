
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd");

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
    {
        name: 'East strand',
        plant: 'Smelter',
        division: 'Iron injection',
        location: 'Iron Injection - PCM2',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'UNISP',
        serialNumber: 'TBD',
        installationDate: todayFormatted,
    },
    {
        name: 'West strand',
        plant: 'Smelter',
        division: 'Iron injection',
        location: 'Iron Injection - PCM2',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'UNISP',
        serialNumber: 'TBD',
        installationDate: todayFormatted,
    },
    {
        name: 'Mould Wash Spray Pump East',
        plant: 'Smelter',
        division: 'Iron injection',
        location: 'Iron Injection - PCM2',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'UNISP',
        serialNumber: 'TBD',
        installationDate: todayFormatted,
    },
];
