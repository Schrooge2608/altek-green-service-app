import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd");

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
  {
    name: "East strand",
    driveType: "VSD",
    manufacturer: "Control Techniques",
    model: "UNISP",
    location: "Iron Injection - PCM2",
    plant: 'Smelter',
    division: 'Iron Injection',
    serialNumber: 'PCM2-SN-001',
    installationDate: todayFormatted,
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
  },
  {
    name: "West strand",
    driveType: "VSD",
    manufacturer: "Control Techniques",
    model: "UNISP",
    location: "Iron Injection - PCM2",
    plant: 'Smelter',
    division: 'Iron Injection',
    serialNumber: 'PCM2-SN-002',
    installationDate: todayFormatted,
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
  },
  {
    name: "Mould Wash Spray Pump East",
    driveType: "VSD",
    manufacturer: "Control Techniques",
    model: "UNISP",
    location: "Iron Injection - PCM2",
    plant: 'Smelter',
    division: 'Iron Injection',
    serialNumber: 'PCM2-SN-003',
    installationDate: todayFormatted,
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
  }
];
