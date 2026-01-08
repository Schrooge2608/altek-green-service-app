

export interface VSD {
  id: string;
  serialNumber: string;
  equipmentId: string;
  model: string;
  installationDate: string;
  status: 'active' | 'inactive' | 'maintenance';
}

export interface Equipment {
  id: string;
  name: string;
  type: 'Pump';
  location: string;
  plant: 'Mining' | 'Smelter';
  division?: 'Boosters';
  vsdId: string;
  pumpHead: number;
  flowRate: number;
  lastMaintenance: string;
  nextMaintenance: string;
  uptime: number;
  powerConsumption: number;
  imageUrl?: string;
  motorModel?: string;
  motorPower?: number;
  motorVoltage?: number;
  motorSerialNumber?: string;
  motorAssignedToId?: string;
  motorAssignedToName?: string;
  totalDowntimeHours?: number;
  breakerModel?: string;
  breakerAmperage?: number;
  breakerLocation?: string;
  protectionAssignedToId?: string;
  protectionAssignedToName?: string;
  assignedToId?: string;
  assignedToName?: string;
}

export interface MaintenanceTask {
  id: string;
  equipmentId: string;
  equipmentName: string;
  component: 'VSD' | 'Protection' | 'Motor' | 'Pump';
  task: string;
  dueDate: string;
  frequency: 'Weekly' | 'Monthly' | '3-Monthly' | '6-Monthly' | 'Yearly';
  status: 'pending' | 'completed' | 'overdue';
  assignedToId: string;
  assignedToName: string;
}

export interface Breakdown {
  id: string;
  equipmentId: string;
  equipmentName: string;
  date: string;
  description: string;
  resolved: boolean;
  resolution?: string;
  normalHours?: number;
  overtimeHours?: number;
  timeReported?: string;
  timeBackInService?: string;
}

export interface CompletedSchedule {
  id: string;
  equipmentId: string;
  equipmentName: string;
  area: string;
  completionDate: string;
  inspectedBy: string;
  maintenanceType: 'VSDs' | 'Protection' | 'Motors' | 'Pumps';
  frequency: 'Weekly' | 'Monthly' | '3-Monthly' | '6-Monthly' | 'Yearly';
  workCrew?: WorkCrewMember[];
  checklist?: ChecklistItem[];
}

export interface WorkCrewMember {
  name: string;
  rtbsNo: string;
  date: string;
  signature: string;
}

export interface ChecklistItem {
  task: string;
  status: 'checked' | 'not-checked' | 'n/a';
  comments: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Technician' | 'Site Supervisor' | 'Services Manager' | 'Corporate Manager' | 'Admin';
  phoneNumber?: string;
  address?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
}
