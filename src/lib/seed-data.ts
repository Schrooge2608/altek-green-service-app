
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
    {
        name: 'Water Booster Pump',
        location: 'MPC Dry Mining',
        plant: 'Mining',
        division: 'Dredgers',
        model: 'Sinamics G150',
        serialNumber: 'SN-MPC-DM-WBP-01',
        installationDate: todayFormatted,
        manufacturer: 'Siemens',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        assignedToId: '',
        assignedToName: 'Unassigned',
        breakdownStatus: 'None',
        totalDowntimeHours: 0,
        driveType: 'VSD',
      },
      {
        name: 'Slurry Pump',
        location: 'MPC Dry Mining',
        plant: 'Mining',
        division: 'Dredgers',
        model: 'Sinamics G150',
        serialNumber: 'SN-MPC-DM-SP-01',
        installationDate: todayFormatted,
        manufacturer: 'Siemens',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        assignedToId: '',
        assignedToName: 'Unassigned',
        breakdownStatus: 'None',
        totalDowntimeHours: 0,
        driveType: 'VSD',
      },
      {
        name: 'Water Booster Pump',
        location: 'MPE Dry Mining',
        plant: 'Mining',
        division: 'Dredgers',
        model: 'Sinamics G150',
        serialNumber: 'SN-MPE-DM-WBP-01',
        installationDate: todayFormatted,
        manufacturer: 'Siemens',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        assignedToId: '',
        assignedToName: 'Unassigned',
        breakdownStatus: 'None',
        totalDowntimeHours: 0,
        driveType: 'VSD',
      },
      {
        name: 'Slurry Pump',
        location: 'MPE Dry Mining',
        plant: 'Mining',
        division: 'Dredgers',
        model: 'Sinamics G150',
        serialNumber: 'SN-MPE-DM-SP-01',
        installationDate: todayFormatted,
        manufacturer: 'Siemens',
        lastMaintenance: todayFormatted,
        nextMaintenance: nextMaintenanceDate,
        assignedToId: '',
        assignedToName: 'Unassigned',
        breakdownStatus: 'None',
        totalDowntimeHours: 0,
        driveType: 'VSD',
      },
];
