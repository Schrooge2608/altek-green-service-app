
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd");

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
  {
    name: 'Injection station hood 1',
    location: 'Iron Injection - Fumehood',
    plant: 'Smelter',
    division: 'Iron Injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'UNISP',
    serialNumber: 'fumehood-1-sn',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Control Techniques',
  },
  {
    name: 'Injection station hood 2',
    location: 'Iron Injection - Fumehood',
    plant: 'Smelter',
    division: 'Iron Injection',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'UNISP',
    serialNumber: 'fumehood-2-sn',
    installationDate: todayFormatted,
    driveType: 'VSD',
    manufacturer: 'Control Techniques',
  },
];
