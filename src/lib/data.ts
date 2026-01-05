import type { VSD, Equipment, MaintenanceTask, Breakdown } from './types';

export const vsds: VSD[] = [
  { id: 'vsd-001', serialNumber: 'SN-A1B2-C3D4', equipmentId: 'pump-001', model: 'Altek Drive 5000', installationDate: '2023-01-15', status: 'active' },
  { id: 'vsd-002', serialNumber: 'SN-E5F6-G7H8', equipmentId: 'fan-001', model: 'Altek Flow Master', installationDate: '2023-03-20', status: 'active' },
  { id: 'vsd-003', serialNumber: 'SN-I9J0-K1L2', equipmentId: 'pump-002', model: 'Altek Drive 5000', installationDate: '2022-11-01', status: 'maintenance' },
  { id: 'vsd-004', serialNumber: 'SN-M3N4-O5P6', equipmentId: 'compressor-001', model: 'Altek PowerPress', installationDate: '2023-05-10', status: 'inactive' },
];

export const equipment: Equipment[] = [
  { id: 'pump-001', name: 'Main Water Pump', type: 'Pump', location: 'Sector A', vsdId: 'vsd-001', pumpHead: 50, flowRate: 120, lastMaintenance: '2024-06-01', nextMaintenance: '2024-09-01', uptime: 99.8, powerConsumption: 4500 },
  { id: 'fan-001', name: 'Cooling Tower Fan', type: 'Fan', location: 'Sector B', vsdId: 'vsd-002', pumpHead: 0, flowRate: 0, lastMaintenance: '2024-05-15', nextMaintenance: '2024-08-15', uptime: 99.5, powerConsumption: 3200 },
  { id: 'pump-002', name: 'Secondary Feed Pump', type: 'Pump', location: 'Sector A', vsdId: 'vsd-003', pumpHead: 35, flowRate: 80, lastMaintenance: '2024-07-01', nextMaintenance: '2024-10-01', uptime: 98.2, powerConsumption: 3000 },
  { id: 'compressor-001', name: 'Air Compressor 1', type: 'Utility Room', location: 'Utility Room', vsdId: 'vsd-004', pumpHead: 0, flowRate: 0, lastMaintenance: '2024-04-20', nextMaintenance: '2024-07-20', uptime: 95.0, powerConsumption: 6000 },
];

export const maintenanceTasks: MaintenanceTask[] = [
  { id: 'task-001', equipmentId: 'pump-001', equipmentName: 'Main Water Pump', task: 'Check bearing lubrication', dueDate: '2024-07-15', frequency: 'Weekly', status: 'pending' },
  { id: 'task-002', equipmentId: 'fan-001', equipmentName: 'Cooling Tower Fan', task: 'Inspect fan blades for damage', dueDate: '2024-07-16', frequency: 'Weekly', status: 'pending' },
  { id: 'task-003', equipmentId: 'pump-001', equipmentName: 'Main Water Pump', task: 'Full pump inspection', dueDate: '2024-07-30', frequency: 'Monthly', status: 'pending' },
  { id: 'task-004', equipmentId: 'pump-002', equipmentName: 'Secondary Feed Pump', task: 'Replace impeller seals', dueDate: '2024-08-01', frequency: '3-Monthly', status: 'overdue' },
  { id: 'task-005', equipmentId: 'compressor-001', equipmentName: 'Air Compressor 1', task: 'Check oil levels', dueDate: '2024-07-10', frequency: 'Weekly', status: 'completed' },
];

export const breakdowns: Breakdown[] = [
  { id: 'brk-001', equipmentId: 'pump-002', equipmentName: 'Secondary Feed Pump', date: '2024-05-20', description: 'Motor overheating, automatic shutdown.', resolved: true, resolution: 'Cleaned air intake and replaced faulty sensor.' },
  { id: 'brk-002', equipmentId: 'compressor-001', equipmentName: 'Air Compressor 1', date: '2024-06-12', description: 'Unusual noise from the piston.', resolved: false },
];
