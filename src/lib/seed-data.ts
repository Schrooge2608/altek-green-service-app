
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(today.setMonth(today.getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
  // Example of how to add data:
  /*
  {
    plant: 'Mining',
    division: 'Pump Stations',
    type: 'Pump',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    uptime: 100,
    powerConsumption: 0,
    totalDowntimeHours: 0,
    assignedToId: '',
    assignedToName: '',
    pumpHead: 0,
    flowRate: 0,
    installationDate: todayFormatted,
    name: 'New Pump',
    location: 'New Location',
    model: 'New Model',
    serialNumber: 'New-SN-001'
  },
  */
];
