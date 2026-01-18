
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
  { 
    name: "Apron Feeder", 
    location: "North Screen", 
    plant: 'Smelter', 
    division: 'North Screen', 
    model: "SMC-FLEX", 
    serialNumber: "TBC", 
    installationDate: "2024-01-01", 
    assignedToName: "John Doe", 
    driveType: 'Soft Starter', 
    manufacturer: 'Allen-Bradley' 
  },
];
