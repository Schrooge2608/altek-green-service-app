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
    location: 'Iron Injection - West Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    driveType: 'VSD',
    manufacturer: 'Siemens',
    model: 'Masterdrive',
    serialNumber: 'sn-westcrane-mh1',
    installationDate: todayFormatted,
  },
  {
    name: 'Main hoist 2',
    location: 'Iron Injection - West Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    driveType: 'VSD',
    manufacturer: 'Siemens',
    model: 'Masterdrive',
    serialNumber: 'sn-westcrane-mh2',
    installationDate: todayFormatted,
  },
  {
    name: 'Long travel',
    location: 'Iron Injection - West Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    driveType: 'VSD',
    manufacturer: 'Siemens',
    model: 'Masterdrive',
    serialNumber: 'sn-westcrane-lt',
    installationDate: todayFormatted,
  },
  {
    name: 'Aux hoist',
    location: 'Iron Injection - West Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    driveType: 'VSD',
    manufacturer: 'Siemens',
    model: 'Masterdrive',
    serialNumber: 'sn-westcrane-ah',
    installationDate: todayFormatted,
  },
  {
    name: 'Cross travel',
    location: 'Iron Injection - West Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    driveType: 'VSD',
    manufacturer: 'Siemens',
    model: 'Masterdrive',
    serialNumber: 'sn-westcrane-ct',
    installationDate: todayFormatted,
  },
];
