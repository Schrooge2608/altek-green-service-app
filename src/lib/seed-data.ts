
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
  { name: "Crane 1 Long Travel", location: "Stripping crane 1", plant: 'Smelter', division: 'Stripping Crane', model: "ATV610D90N4", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Schneider' },
  { name: "Crane 1 Main Hoist", location: "Stripping crane 1", plant: 'Smelter', division: 'Stripping Crane', model: "ATV610C11N4", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Schneider' },
  { name: "Crane 1 Cross Travel", location: "Stripping crane 1", plant: 'Smelter', division: 'Stripping Crane', model: "ATV610D22N4", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Schneider' },
  { name: "Crane 1 Aux Hoist", location: "Stripping crane 1", plant: 'Smelter', division: 'Stripping Crane', model: "ATV610D30N4", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Schneider' },
  { name: "Crane 2 Long Travel", location: "Stripping crane 2", plant: 'Smelter', division: 'Stripping Crane', model: "ATV610D90N4", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Schneider' },
  { name: "Crane 2 Main Hoist", location: "Stripping crane 2", plant: 'Smelter', division: 'Stripping Crane', model: "ATV610C11N4", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Schneider' },
  { name: "Crane 2 Cross Travel", location: "Stripping crane 2", plant: 'Smelter', division: 'Stripping Crane', model: "ATV610D22N4", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Schneider' },
  { name: "Crane 2 Aux Hoist", location: "Stripping crane 2", plant: 'Smelter', division: 'Stripping Crane', model: "ATV610D30N4", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Schneider' }
];
