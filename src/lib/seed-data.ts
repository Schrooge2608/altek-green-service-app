
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const equipmentToSeed: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
    // Roaster 1&2
    { name: 'Roaster Exhaust Fan 28', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'VSD', manufacturer: 'ABB', model: 'ACS880', serialNumber: 'ROASTER-001', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Roaster Main Air Fan 26', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'VSD', manufacturer: 'ABB', model: 'ACS880', serialNumber: 'ROASTER-002', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Secondary Air Fan', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'Soft Starter', manufacturer: 'AuCom', model: 'EMX3-0500B', serialNumber: 'ROASTER-003', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Roaster Exhaust Fan 29', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'Soft Starter', manufacturer: 'AuCom', model: 'EMX3-0500B', serialNumber: 'ROASTER-004', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Roaster Main Air Fan 27', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'Soft Starter', manufacturer: 'AuCom', model: 'EMX3-0500B', serialNumber: 'ROASTER-005', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Combustion Air Fan 19', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'Soft Starter', manufacturer: 'AuCom', model: 'EMX3-0145B', serialNumber: 'ROASTER-006', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Cooling Air Fan 18', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'Soft Starter', manufacturer: 'AuCom', model: 'EMX3-0145B', serialNumber: 'ROASTER-007', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Cooling Air Fan 20', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'VSD', manufacturer: 'Yaskawa', model: 'A1000', serialNumber: 'ROASTER-008', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Cooling Air Fan 21', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'VSD', manufacturer: 'Yaskawa', model: 'A1000', serialNumber: 'ROASTER-009', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Cooling Air Fan 22', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'VSD', manufacturer: 'Yaskawa', model: 'A1000', serialNumber: 'ROASTER-010', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Cooling Air Fan 23', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'VSD', manufacturer: 'Yaskawa', model: 'A1000', serialNumber: 'ROASTER-011', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Cooling Air Fan 24', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'VSD', manufacturer: 'Yaskawa', model: 'A1000', serialNumber: 'ROASTER-012', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    { name: 'Cooling Air Fan 25', plant: 'Smelter', division: 'Roaster', location: 'Roaster 1&2', driveType: 'VSD', manufacturer: 'Yaskawa', model: 'A1000', serialNumber: 'ROASTER-013', installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate },
    
    // Roaster - RTR Magnets
    ...Array.from({ length: 5 }, (_, i) => ({ name: `RTR Magnets Bank 1 Module ${i + 1}`, plant: 'Smelter' as const, division: 'Roaster' as const, location: 'Roaster - RTR Magnets', driveType: 'VSD' as const, manufacturer: 'Allen Bradley', model: 'Powerflex 40', serialNumber: `RTR-B1-M${i + 1}`, installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate })),
    ...Array.from({ length: 5 }, (_, i) => ({ name: `RTR Magnets Bank 2 Module ${i + 1}`, plant: 'Smelter' as const, division: 'Roaster' as const, location: 'Roaster - RTR Magnets', driveType: 'VSD' as const, manufacturer: 'Allen Bradley', model: 'Powerflex 40', serialNumber: `RTR-B2-M${i + 1}`, installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate })),
    ...Array.from({ length: 5 }, (_, i) => ({ name: `RTR Magnets Bank 3 Module ${i + 1}`, plant: 'Smelter' as const, division: 'Roaster' as const, location: 'Roaster - RTR Magnets', driveType: 'VSD' as const, manufacturer: 'Allen Bradley', model: 'Powerflex 40', serialNumber: `RTR-B3-M${i + 1}`, installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate })),
    ...Array.from({ length: 5 }, (_, i) => ({ name: `RTR Magnets Bank 4 Module ${i + 1}`, plant: 'Smelter' as const, division: 'Roaster' as const, location: 'Roaster - RTR Magnets', driveType: 'VSD' as const, manufacturer: 'Allen Bradley', model: 'Powerflex 40', serialNumber: `RTR-B4-M${i + 1}`, installationDate: todayFormatted, lastMaintenance: todayFormatted, nextMaintenance: nextMaintenanceDate })),
];
