





export interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  plant: 'Mining' | 'Smelter';
  division?: 'Boosters' | 'Dredgers' | 'Pump Stations';
  vsdId: string;
  lastMaintenance: string;
  nextMaintenance: string;
  uptime: number;
  powerConsumption: number;
  imageUrl?: string;
  // Motor fields
  motorModel?: string;
  motorPower?: number;
  motorVoltage?: number;
  motorSerialNumber?: string;
  // Protection fields
  breakerModel?: string;
  breakerAmperage?: number;
  breakerLocation?: string;
  // Pump fields
  pumpHead?: number;
  flowRate?: number;
  pumpModel?: string;
  pumpSerialNumber?: string;
  // Downtime
  totalDowntimeHours?: number;
  // VSD is not a separate type but its fields are on Equipment
  status: 'active' | 'inactive' | 'maintenance';
  model: string;
  serialNumber: string;
  installationDate: string;
  assignedToId?: string;
  assignedToName?: string;
}

export interface VSD {
  id: string;
  serialNumber: string;
  equipmentId: string;
  model: string;
  installationDate: string;
  status: 'active' | 'inactive' | 'maintenance';
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
  role: 'Technician' | 'Junior Technician' | 'Technologist' | 'Power systems engineer' | 'HVAC product specialist' | 'Site Supervisor' | 'Services Manager' | 'Corporate Manager' | 'Admin' | 'Data Admin' | 'Superadmin';
  phoneNumber?: string;
  address?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  sapNumber?: string;
  qualifications?: string;
  designatedLeaderName?: string;
  responsibleGenManager?: string;
  department?: string;
  section?: string;
  purchaseOrderNo?: string;
  justification?: string;
}

    
