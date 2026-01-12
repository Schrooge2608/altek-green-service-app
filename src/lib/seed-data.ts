
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(today.setMonth(today.getMonth() + 3)), 'yyyy-MM-dd');

const baseEquipment = {
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
} as const;

export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string }> = [
  // Hlabane
  { ...baseEquipment, name: 'Pump No.1', location: 'HLABANE', model: 'ABB ACS 880', serialNumber: 'SN-HLAB-001' },
  { ...baseEquipment, name: 'Pump No.2', location: 'HLABANE', model: 'ABB ACS 880', serialNumber: 'SN-HLAB-002' },
  { ...baseEquipment, name: 'Pump No.3', location: 'HLABANE', model: 'ABB ACS 880', serialNumber: 'SN-HLAB-003' },
  { ...baseEquipment, name: 'Pump No.4', location: 'HLABANE', model: 'ABB ACS 880', serialNumber: 'SN-HLAB-004' },
  { ...baseEquipment, name: 'Pump No.5', location: 'HLABANE', model: 'ABB ACS 880', serialNumber: 'SN-HLAB-005' },
  { ...baseEquipment, name: 'Pump No.6', location: 'HLABANE', model: 'ABB ACS 880', serialNumber: 'SN-HLAB-006' },
  { ...baseEquipment, name: 'Pump No.7', location: 'HLABANE', model: 'ABB ACS880', serialNumber: 'SN-HLAB-007' },
  { ...baseEquipment, name: 'Pump No.8', location: 'HLABANE', model: 'ABB ACS880', serialNumber: 'SN-HLAB-008' },
  // Mposa Pump Station
  { ...baseEquipment, name: 'Pump set 1 - Stage 1', location: 'Mposa Pump Station', model: 'ALTISTART 48 S/S', serialNumber: 'SN-MPOSA-001' },
  { ...baseEquipment, name: 'Pump set 1 - Stage 2', location: 'Mposa Pump Station', model: 'ALTISTART 48 S/S', serialNumber: 'SN-MPOSA-002' },
  { ...baseEquipment, name: 'Pump set 2 - Stage 1', location: 'Mposa Pump Station', model: 'ALTISTART 48 S/S', serialNumber: 'SN-MPOSA-003' },
  { ...baseEquipment, name: 'Pump set 2 - Stage 2', location: 'Mposa Pump Station', model: 'ALTISTART 48 S/S', serialNumber: 'SN-MPOSA-004' },
  { ...baseEquipment, name: 'Pump set 3 - Stage 1', location: 'Mposa Pump Station', model: 'ALTISTART 48 S/S', serialNumber: 'SN-MPOSA-005' },
  { ...baseEquipment, name: 'Pump set 3 - Stage 2', location: 'Mposa Pump Station', model: 'ALTISTART 48 S/S', serialNumber: 'SN-MPOSA-006' },
  // Monzi Pump Station
  { ...baseEquipment, name: 'Pump No. 2', location: 'Monzi Pump Station', model: 'SOFT STARTER', serialNumber: 'SN-MONZI-001' },
  { ...baseEquipment, name: 'Pump No. 1.1', location: 'Monzi Pump Station', model: 'ABB ACS800', serialNumber: 'SN-MONZI-002' },
];
