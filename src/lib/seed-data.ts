
import type { Equipment } from './types';
import { format } from 'date-fns';

const today = new Date();
const todayFormatted = format(today, 'yyyy-MM-dd');
const nextMaintenanceDate = format(new Date(new Date().setMonth(new Date().getMonth() + 3)), 'yyyy-MM-dd');

// This file is ready for future data seeding.
// To add new equipment, populate this array following the example structure.
export const pumpStations: Array<Omit<Equipment, 'id' | 'vsdId' | 'status' > & { model: string; serialNumber: string, installationDate: string, driveType?: 'VSD' | 'Soft Starter', manufacturer?: string }> = [
  { name: "S30 Vibrator Feeder", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "Micromaster 440", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Siemens' },
  { name: "S18B Feed Conveyor", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "UNISP", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Control Techniques' },
  { name: "Regrind Bag House Main Air Fan", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "Regrind Bag House Exhaust Fan", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "Baghouse Exhaust Fan", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "S18A Feed Conveyor", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "Micromaster 440", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Siemens' },
  { name: "S19 Transfer Conveyor", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "S20 Transfer Conveyor", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "Brute course silo no.1", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "VLT FC302", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Danfoss' },
  { name: "Brute course silo no.2", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "VLT FC302", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Danfoss' },
  { name: "Brute course silo no.3", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "VLT FC302", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Danfoss' },
  { name: "Chain conveyor", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "VLT FC302", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Danfoss' },
  { name: "Aerofall Mill Main Air Fan", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "Aerofall Mill Main Drive", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "Aerofall Mill Bag House Exhaust Fan", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "G150 Sinamics", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Siemens' },
  { name: "Coarse Silo Scrubber Fan", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "Micromaster 440", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Siemens' },
  { name: "North screen Bag House / Fan 1", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "Micromaster 440", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Siemens' },
  { name: "South Screen Bag House / Fan 2", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "Micromaster 440", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'Siemens' },
  { name: "Jaw Crusher", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "S3 Conveyor", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "Crusher", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "ACS880", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'VSD', manufacturer: 'ABB' },
  { name: "Slag Cooling Water Pump 1", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "Slag Cooling Water Pump 2", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' },
  { name: "Slag Cooling Water Pump 3", location: "Slag plant", plant: 'Smelter', division: 'Slag plant', model: "SMC-FLEX", serialNumber: "TBC", installationDate: "2024-01-01", assignedToName: "John Doe", driveType: 'Soft Starter', manufacturer: 'Allen-Bradley' }
];
