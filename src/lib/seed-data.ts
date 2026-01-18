
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
    { name: 'Travelling Grate', location: 'Charplant - Stoker 1', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Control Techniques UNI SP', serialNumber: 'TBD-CP-S1-TG', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Vibrating feeder East', location: 'Charplant - Stoker 1', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Allen Bradley Powerflex 40', serialNumber: 'TBD-CP-S1-VFE', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Vibrating feeder West', location: 'Charplant - Stoker 1', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Allen Bradley Powerflex 40', serialNumber: 'TBD-CP-S1-VFW', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Travelling Grate', location: 'Charplant - Stoker 2', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Control Techniques UNI SP', serialNumber: 'TBD-CP-S2-TG', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Vibrating feeder East', location: 'Charplant - Stoker 2', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Allen Bradley Powerflex 40', serialNumber: 'TBD-CP-S2-VFE', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Vibrating feeder West', location: 'Charplant - Stoker 2', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Allen Bradley Powerflex 40', serialNumber: 'TBD-CP-S2-VFW', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Screw Conveyor 1', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Siemens Micromaster 440', serialNumber: 'TBD-CP-BH-SC1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Screw Conveyor 2', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Siemens Micromaster 440', serialNumber: 'TBD-CP-BH-SC2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Screw Conveyor 3', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Siemens Micromaster 440', serialNumber: 'TBD-CP-BH-SC3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
    { name: 'Rotary Valve 3', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Siemens Micromaster 440', serialNumber: 'TBD-CP-BH-RV3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
];
