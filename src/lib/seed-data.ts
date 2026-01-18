
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
  // Roaster 1&2
  { name: 'ID fan', location: 'Roaster 1&2', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-R-12-IDF', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Recycle gas fan', location: 'Roaster 1&2', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-R-12-RGF', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Recycle dust fan', location: 'Roaster 1&2', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-R-12-RDF', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'PA Fan no.1', location: 'Roaster 1&2', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-R-12-PAF1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'PA Fan no.2', location: 'Roaster 1&2', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-R-12-PAF2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Fluidizing air fan no.1', location: 'Roaster 1&2', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-R-12-FAF1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Fluidizing air fan no.2', location: 'Roaster 1&2', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-R-12-FAF2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Calcine transfer fan no.2', location: 'Roaster 1&2', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5005', serialNumber: 'TBD-R-12-CTF2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // 3,3KV Blowers
  { name: 'Elliot Blower no.1', location: '3,3KV Blowers', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'PERFECT HARMONY', serialNumber: 'TBD-R-B-EB1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Elliot Blower no.2', location: '3,3KV Blowers', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'PERFECT HARMONY', serialNumber: 'TBD-R-B-EB2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Elliot Blower no.3', location: '3,3KV Blowers', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'PERFECT HARMONY', serialNumber: 'TBD-R-B-EB3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Mag Separation
  ...Array.from({ length: 52 }, (_, i) => ({
    name: `Magnet no.${i + 1}`,
    location: 'Mag Separation',
    plant: 'Smelter',
    division: 'Roaster',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'M400',
    serialNumber: `TBD-R-MS-M${i + 1}`,
    installationDate: todayFormatted,
    uptime: 100,
    powerConsumption: 0,
  })),
  // Roaster - RTR Magnets
  ...Array.from({ length: 18 }, (_, i) => ({
    name: `Magnet no.${i + 1}`,
    location: 'Roaster - RTR Magnets',
    plant: 'Smelter',
    division: 'Roaster',
    lastMaintenance: todayFormatted,
    nextMaintenance: nextMaintenanceDate,
    model: 'UNIDRIVE SP',
    serialNumber: `TBD-R-RTR-M${i + 1}`,
    installationDate: todayFormatted,
    uptime: 100,
    powerConsumption: 0,
  })),
  // Smelter feed
  { name: 'Calcine transfer fan no.1', location: 'Smelter feed', plant: 'Smelter', division: 'Roaster', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5005', serialNumber: 'TBD-R-SF-CTF1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Charplant - Stoker 1
  { name: 'Stoker 1 grate drive', location: 'Charplant - Stoker 1', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNIDRIVE M700', serialNumber: 'TBD-CP-S1-GD', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Stoker 1 ID Fan', location: 'Charplant - Stoker 1', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-CP-S1-IDF', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Charplant - Stoker 2
  { name: 'Stoker 2 grate drive', location: 'Charplant - Stoker 2', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNIDRIVE M700', serialNumber: 'TBD-CP-S2-GD', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Stoker 2 ID Fan', location: 'Charplant - Stoker 2', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-CP-S2-IDF', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Charplant - Baghouse
  { name: 'Main baghouse fan', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'POWERDRIVE', serialNumber: 'TBD-CP-BH-MBF', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Main baghouse screw conveyor no.1', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5004', serialNumber: 'TBD-CP-BH-SC1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Main baghouse screw conveyor no.2', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5004', serialNumber: 'TBD-CP-BH-SC2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Main baghouse screw conveyor no.3', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5004', serialNumber: 'TBD-CP-BH-SC3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Main baghouse screw conveyor no.4', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5004', serialNumber: 'TBD-CP-BH-SC4', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Main baghouse rotary valve', location: 'Charplant - Baghouse', plant: 'Smelter', division: 'Char Plant', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT5004', serialNumber: 'TBD-CP-BH-RV', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Smelter - SF1
  { name: 'Electrode drives no.1', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF1-ED1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.2', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF1-ED2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.3', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF1-ED3', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.4', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF1-ED4', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.5', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF1-ED5', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.6', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF1-ED6', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Electrode drives no.7', location: 'Smelter - SF1', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'M700', serialNumber: 'TBD-SM-SF1-ED7', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Smelter - Common
  { name: 'Furnace hoist', location: 'Smelter - Common', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'FR-A800', serialNumber: 'TBD-SM-COM-FH', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Matte crane', location: 'Smelter - Common', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT2881', serialNumber: 'TBD-SM-COM-MC', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Slag crane', location: 'Smelter - Common', plant: 'Smelter', division: 'Smelter', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'VLT2881', serialNumber: 'TBD-SM-COM-SC', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
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
  // Iron Injection - West Crane
  { name: 'Main hoist 1', location: 'Iron Injection - West Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Masterdrive', serialNumber: 'TBD-SM-IIWC-MH1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Main hoist 2', location: 'Iron Injection - West Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Masterdrive', serialNumber: 'TBD-SM-IIWC-MH2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Long travel', location: 'Iron Injection - West Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Masterdrive', serialNumber: 'TBD-SM-IIWC-LT', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Aux hoist', location: 'Iron Injection - West Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Masterdrive', serialNumber: 'TBD-SM-IIWC-AH', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Cross travel', location: 'Iron Injection - West Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Masterdrive', serialNumber: 'TBD-SM-IIWC-CT', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Iron Injection - East Crane
  { name: 'Main hoist 1', location: 'Iron Injection - East Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'ACS800', serialNumber: 'TBD-SM-IIEC-MH1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Main hoist 2', location: 'Iron Injection - East Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'ACS800', serialNumber: 'TBD-SM-IIEC-MH2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Long travel', location: 'Iron Injection - East Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'ACS800', serialNumber: 'TBD-SM-IIEC-LT', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Aux hoist', location: 'Iron Injection - East Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'ACS800', serialNumber: 'TBD-SM-IIEC-AH', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Cross travel', location: 'Iron Injection - East Crane', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'ACS800', serialNumber: 'TBD-SM-IIEC-CT', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Iron Injection - PCM1
  { name: 'Casting ladle tilter', location: 'Iron Injection - PCM1', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'Simoreg DC', serialNumber: 'TBD-SM-IIP1-CLT', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'West strand', location: 'Iron Injection - PCM1', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-IIP1-WS', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'East strand', location: 'Iron Injection - PCM1', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-IIP1-ES', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Iron Injection - PCM2
  { name: 'East strand', location: 'Iron Injection - PCM2', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-IIP2-ES', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'West strand', location: 'Iron Injection - PCM2', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-IIP2-WS', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Mould Wash Spray Pump East', location: 'Iron Injection - PCM2', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-IIP2-MWSP', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  // Iron Injection - Fumehood
  { name: 'Injection station hood 1', location: 'Iron Injection - Fumehood', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-IIF-H1', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
  { name: 'Injection station hood 2', location: 'Iron Injection - Fumehood', plant: 'Smelter', division: 'Iron injection', lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate, model: 'UNISP', serialNumber: 'TBD-SM-IIF-H2', installationDate: todayFormatted, uptime: 100, powerConsumption: 0 },
];
