
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
    {
        name: 'C5 Conveyor',
        location: 'Roaster 1&2',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'UNI SP',
        serialNumber: 'TBD-R1-C5',
        installationDate: todayFormatted,
    },
    {
        name: 'Aerzen Blower',
        location: 'Roaster 1&2',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'ACS800',
        serialNumber: 'TBD-R1-AERZEN',
        installationDate: todayFormatted,
    },
    {
        name: 'Howden Blower 1',
        location: 'Roaster 1&2',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'ACS880',
        serialNumber: 'TBD-R1-HOWDEN1',
        installationDate: todayFormatted,
    },
    {
        name: 'Scrubber Fan 1',
        location: 'Roaster 1&2',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'ACS880',
        serialNumber: 'TBD-R1-SCRUB1',
        installationDate: todayFormatted,
    },
    {
        name: 'C4 Conveyor',
        location: 'Roaster 1&2',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'UNI SP',
        serialNumber: 'TBD-R2-C4',
        installationDate: todayFormatted,
    },
    {
        name: 'Holmes Blower 2',
        location: 'Roaster 1&2',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'ACS800',
        serialNumber: 'TBD-R2-HOLMES',
        installationDate: todayFormatted,
    },
    {
        name: 'Howden Blower 2',
        location: 'Roaster 1&2',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'ACS880',
        serialNumber: 'TBD-R2-HOWDEN2',
        installationDate: todayFormatted,
    },
    {
        name: 'Scrubber Fan 2',
        location: 'Roaster 1&2',
        plant: 'Smelter',
        division: 'Roaster',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        model: 'Sinamics G150',
        serialNumber: 'TBD-R2-SCRUB2',
        installationDate: todayFormatted,
    },
];
