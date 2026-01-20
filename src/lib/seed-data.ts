
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
    model: 'Masterdrive',
    serialNumber: 'SN-WC-MH1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
  {
    name: 'Main hoist 2',
    location: 'Iron Injection - West Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Masterdrive',
    serialNumber: 'SN-WC-MH2',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
  {
    name: 'Long travel',
    location: 'Iron Injection - West Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Masterdrive',
    serialNumber: 'SN-WC-LT1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
  {
    name: 'Aux hoist',
    location: 'Iron Injection - West Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Masterdrive',
    serialNumber: 'SN-WC-AH1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
  {
    name: 'Cross travel',
    location: 'Iron Injection - West Crane',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Masterdrive',
    serialNumber: 'SN-WC-CT1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
];
