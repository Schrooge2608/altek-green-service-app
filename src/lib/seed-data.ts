
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
  // Smelter - SF2
  { name: 'Electrode drives no.1', location: 'Smelter - SF2', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-SF2-ED1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.2', location: 'Smelter - SF2', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-SF2-ED2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.3', location: 'Smelter - SF2', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-SF2-ED3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.4', location: 'Smelter - SF2', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-SF2-ED4', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.5', location: 'Smelter - SF2', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-SF2-ED5', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.6', location: 'Smelter - SF2', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-SF2-ED6', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.7', location: 'Smelter - SF2', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-SF2-ED7', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Smelter - SF3
  { name: 'Electrode drives no.1', location: 'Smelter - SF3', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF3-ED1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.2', location: 'Smelter - SF3', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF3-ED2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.3', location: 'Smelter - SF3', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF3-ED3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.4', location: 'Smelter - SF3', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF3-ED4', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.5', location: 'Smelter - SF3', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF3-ED5', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.6', location: 'Smelter - SF3', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF3-ED6', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.7', location: 'Smelter - SF3', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF3-ED7', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Smelter - SF4
  { name: 'Electrode drives no.1', location: 'Smelter - SF4', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF4-ED1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.2', location: 'Smelter - SF4', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF4-ED2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.3', location: 'Smelter - SF4', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF4-ED3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.4', location: 'Smelter - SF4', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF4-ED4', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.5', location: 'Smelter - SF4', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF4-ED5', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.6', location: 'Smelter - SF4', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF4-ED6', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.7', location: 'Smelter - SF4', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF4-ED7', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Smelter - Clay gun
  { name: 'Claygun 2 long travel controller', location: 'Smelter - Clay gun', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5008', serialNumber: 'TBD-SM-CG-2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Claygun 3 long travel controller', location: 'Smelter - Clay gun', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5008', serialNumber: 'TBD-SM-CG-3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Claygun 4 long travel controller', location: 'Smelter - Clay gun', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5008', serialNumber: 'TBD-SM-CG-4', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Claygun 5 long travel controller', location: 'Smelter - Clay gun', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5008', serialNumber: 'TBD-SM-CG-5', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Claygun 6 long travel controller', location: 'Smelter - Clay gun', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5008', serialNumber: 'TBD-SM-CG-6', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Claygun 7 long travel controller', location: 'Smelter - Clay gun', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5008', serialNumber: 'TBD-SM-CG-7', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Smelter Elevator
  { name: 'Main Elevator Hoist Drive', location: 'Smelter Elevator', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'OTIS', serialNumber: 'TBD-SM-ELEV-1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
];
