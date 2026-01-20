import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd");

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
    {
        name: 'Travelling Grate',
        plant: 'Smelter',
        division: 'Char Plant',
        location: 'Charplant - Stoker 1',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'UNI SP',
        serialNumber: 'N/A',
        installationDate: todayFormatted,
    },
    {
        name: 'Vibrating feeder East',
        plant: 'Smelter',
        division: 'Char Plant',
        location: 'Charplant - Stoker 1',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        driveType: 'VSD',
        manufacturer: 'Allen Bradley',
        model: 'Powerflex 40',
        serialNumber: 'N/A',
        installationDate: todayFormatted,
    },
    {
        name: 'Vibrating feeder West',
        plant: 'Smelter',
        division: 'Char Plant',
        location: 'Charplant - Stoker 1',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        driveType: 'VSD',
        manufacturer: 'Allen Bradley',
        model: 'Powerflex 40',
        serialNumber: 'N/A',
        installationDate: todayFormatted,
    },
    {
        name: 'Travelling Grate',
        plant: 'Smelter',
        division: 'Char Plant',
        location: 'Charplant - Stoker 2',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'UNI SP',
        serialNumber: 'N/A',
        installationDate: todayFormatted,
    },
    {
        name: 'Vibrating feeder East',
        plant: 'Smelter',
        division: 'Char Plant',
        location: 'Charplant - Stoker 2',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        driveType: 'VSD',
        manufacturer: 'Allen Bradley',
        model: 'Powerflex 40',
        serialNumber: 'N/A',
        installationDate: todayFormatted,
    },
    {
        name: 'Vibrating feeder West',
        plant: 'Smelter',
        division: 'Char Plant',
        location: 'Charplant - Stoker 2',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        driveType: 'VSD',
        manufacturer: 'Allen Bradley',
        model: 'Powerflex 40',
        serialNumber: 'N/A',
        installationDate: todayFormatted,
    },
];
