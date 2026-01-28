
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd");

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
  {
    name: 'Casting ladle tilter',
    plant: 'Smelter',
    division: 'Iron Injection',
    location: 'Iron Injection - PCM1',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'Simoreg DC',
    serialNumber: 'SN-TBD-001',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens',
  },
  {
    name: 'West strand',
    plant: 'Smelter',
    division: 'Iron Injection',
    location: 'Iron Injection - PCM1',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'UNISP',
    serialNumber: 'SN-TBD-002',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Control Techniques',
  },
  {
    name: 'East strand',
    plant: 'Smelter',
    division: 'Iron Injection',
    location: 'Iron Injection - PCM1',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'UNISP',
    serialNumber: 'SN-TBD-003',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Control Techniques',
  },
];
