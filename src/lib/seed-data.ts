
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
    { name: 'Electrode drive no.1', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Control Techniques UNISP', serialNumber: 'TBD-SM-SF1-ED1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Electrode drive no.2', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Control Techniques UNISP', serialNumber: 'TBD-SM-SF1-ED2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Electrode drive no.3', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Control Techniques UNISP', serialNumber: 'TBD-SM-SF1-ED3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Electrode drive no.4', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Control Techniques UNISP', serialNumber: 'TBD-SM-SF1-ED4', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Electrode drive no.5', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Control Techniques UNISP', serialNumber: 'TBD-SM-SF1-ED5', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Electrode drive no.6', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Control Techniques UNISP', serialNumber: 'TBD-SM-SF1-ED6', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Electrode drive no.7', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Control Techniques UNISP', serialNumber: 'TBD-SM-SF1-ED7', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
];
