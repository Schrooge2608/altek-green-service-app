
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
    { name: 'Conveyor west', location: 'Smelter - Common', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'SMC-FLEX', serialNumber: 'TBD-SM-COM-CW1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Tripper Car East', location: 'Smelter - Common', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-COM-TCE1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Tripper Car West', location: 'Smelter - Common', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-COM-TCW1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
];
