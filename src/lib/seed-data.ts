
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd");

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
  {
    name: 'Main hoist 1',
    location: 'Iron Injection - East Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    driveType: 'VSD',
    manufacturer: 'DEMAG',
    model: 'ACS800',
    serialNumber: 'sn-east-crane-1',
    installationDate: todayFormatted,
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
  },
  {
    name: 'Main hoist 2',
    location: 'Iron Injection - East Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    driveType: 'VSD',
    manufacturer: 'DEMAG',
    model: 'ACS800',
    serialNumber: 'sn-east-crane-2',
    installationDate: todayFormatted,
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
  },
  {
    name: 'Long travel',
    location: 'Iron Injection - East Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    driveType: 'VSD',
    manufacturer: 'DEMAG',
    model: 'ACS800',
    serialNumber: 'sn-east-crane-3',
    installationDate: todayFormatted,
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
  },
  {
    name: 'Aux hoist',
    location: 'Iron Injection - East Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    driveType: 'VSD',
    manufacturer: 'DEMAG',
    model: 'ACS800',
    serialNumber: 'sn-east-crane-4',
    installationDate: todayFormatted,
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
  },
  {
    name: 'Cross travel',
    location: 'Iron Injection - East Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    driveType: 'VSD',
    manufacturer: 'DEMAG',
    model: 'ACS800',
    serialNumber: 'sn-east-crane-5',
    installationDate: todayFormatted,
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
  },
];
