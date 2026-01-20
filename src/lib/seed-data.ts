
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd");

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
    {
        name: 'Baghouse Fan',
        location: 'Charplant - Baghouse',
        plant: 'Smelter',
        division: 'Char Plant',
        model: 'VSD-901-BAG-FAN',
        serialNumber: '823V5150',
        motorPower: 55,
        motorSerialNumber: '106093556',
        installationDate: todayFormatted,
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
    },
    {
        name: 'Baghouse Fan EQ',
        location: 'Charplant - Baghouse',
        plant: 'Smelter',
        division: 'Char Plant',
        model: 'VSD-902-BAG-EQ',
        serialNumber: '823V5153',
        motorPower: 55,
        motorSerialNumber: '106093556',
        installationDate: todayFormatted,
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
    },
    {
        name: 'Screw Conveyor 1',
        location: 'Charplant - Baghouse',
        plant: 'Smelter',
        division: 'Char Plant',
        model: 'VSD-903-SCREW1',
        serialNumber: 'M420311A0033',
        motorPower: 4,
        motorSerialNumber: '781524',
        installationDate: todayFormatted,
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
    },
    {
        name: 'Screw Conveyor 2',
        location: 'Charplant - Baghouse',
        plant: 'Smelter',
        division: 'Char Plant',
        model: 'VSD-904-SCREW2',
        serialNumber: 'M420311A0034',
        motorPower: 4,
        motorSerialNumber: '781525',
        installationDate: todayFormatted,
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
    }
];
