
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
    location: 'Iron Injection - PCM1',
    plant: 'Smelter',
    division: 'Iron injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'Simoreg DC',
    serialNumber: 'SN-PCM1-CLT-01',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
  {
    name: 'West strand',
    location: 'Iron Injection - PCM1',
    plant: 'Smelter',
    division: 'Iron injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'UNISP',
    serialNumber: 'SN-PCM1-WS-01',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Control Techniques'
  },
  {
    name: 'East strand',
    location: 'Iron Injection - PCM1',
    plant: 'Smelter',
    division: 'Iron injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'UNISP',
    serialNumber: 'SN-PCM1-ES-01',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Control Techniques'
  }
];
