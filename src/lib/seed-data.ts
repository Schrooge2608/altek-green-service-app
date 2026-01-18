
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
  {
    name: 'Turn Table',
    plant: 'Smelter',
    division: 'Iron injection',
    location: 'Iron Injection - Turn Table',
    manufacturer: 'Allen-Bradley',
    model: 'SMC-FLEX',
    driveType: 'Soft Starter',
    serialNumber: 'SS-AB-SMC-001',
    installationDate: todayFormatted,
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
  }
];
