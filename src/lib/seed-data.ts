
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd");

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
    {
        name: 'REMS 1A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-1A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 1B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-1B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 2A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-2A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 2B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-2B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 3A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-3A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 3B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-3B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 4A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-4A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 4B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-4B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 5A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-5A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 5B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-5B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 6A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-6A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 6B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-6B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 7A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-7A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 7B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-7B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 8A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-8A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 8B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-8B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 9A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-9A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 9B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-9B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 10A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-10A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 10B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-10B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 11A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-11A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 11B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-11B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 12A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-12A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 12B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-12B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 13A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-13A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 13B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-13B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 14A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-14A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 14B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-14B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 15A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-15A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 15B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-15B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 16A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-16A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 16B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-16B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 17A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-17A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 17B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-17B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 18A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-18A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 18B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-18B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 19A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-19A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 19B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-19B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 20A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-20A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 20B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-20B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 21A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-21A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 21B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-21B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 22A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-22A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 22B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-22B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 23A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-23A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 23B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-23B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 24A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-24A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 24B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-24B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 25A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-25A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 25B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-25B',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 26A (Feeder)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-26A',
        installationDate: todayFormatted
    },
    {
        name: 'REMS 26B (Drum)',
        plant: 'Smelter',
        division: 'Roaster',
        location: 'Mag Separation',
        driveType: 'VSD',
        manufacturer: 'Control Techniques',
        model: 'M600',
        serialNumber: 'SN-REMS-26B',
        installationDate: todayFormatted
    },
];
