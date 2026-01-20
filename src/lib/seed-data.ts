
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd");

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
  {
    name: 'PCM 1 Mill Drive',
    location: 'Iron Injection - PCM1',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Sinamics',
    serialNumber: 'SN-PCM1-MD1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
  {
    name: 'PCM 1 Feeder Drive',
    location: 'Iron Injection - PCM1',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Sinamics',
    serialNumber: 'SN-PCM1-FD1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
  {
    name: 'PCM 1 ID Fan Drive',
    location: 'Iron Injection - PCM1',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Sinamics',
    serialNumber: 'SN-PCM1-IDFD1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
    {
    name: 'PCM 1 Seal Air Fan Drive',
    location: 'Iron Injection - PCM1',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Sinamics',
    serialNumber: 'SN-PCM1-SAFD1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
  {
    name: 'PCM 1 Classifier Drive',
    location: 'Iron Injection - PCM1',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Sinamics',
    serialNumber: 'SN-PCM1-CD1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  },
  {
    name: 'PCM 1 Lube Oil Pump',
    location: 'Iron Injection - PCM1',
    plant: 'Smelter',
    division: 'Iron Injection',
    model: 'Micromaster',
    serialNumber: 'SN-PCM1-LOP1',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Siemens'
  }
];
