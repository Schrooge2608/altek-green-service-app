
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(today.setMonth(today.getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
  {
    name: 'Booster Pump No.1',
    plant: 'Mining',
    division: 'Boosters',
    location: 'RWBS',
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
    model: 'ABB ACS880',
    serialNumber: 'RWBS-SN-001'
  },
  {
    name: 'Booster Pump No.2',
    plant: 'Mining',
    division: 'Boosters',
    location: 'RWBS',
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
    model: 'ABB ACS880',
    serialNumber: 'RWBS-SN-002'
  },
];
