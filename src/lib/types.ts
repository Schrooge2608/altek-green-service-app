

export interface Equipment {
  id: string;
  name: string;
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
  motorFrameType?: string;
  motorInstallationDate?: string;
  motorAssignedToId?: string;
  motorAssignedToName?: string;
  // Protection fields
  breakerAssetNumber?: string;
  breakerLocationHierarchy?: string;
  breakerServiceDescription?: string;
  breakerManufacturer?: string;
  breakerModelRange?: string;
  breakerType?: 'MCB' | 'MCCB' | 'ACB' | 'VCB';
  breakerRatedVoltage?: number;
  breakerFrameSize?: number;
  breakerBreakingCapacity?: number;
  breakerNumberOfPoles?: 3 | 4;
  breakerTripUnitType?: 'Thermal-Magnetic' | 'Electronic';
  breakerOverloadSetting?: number;
  breakerShortCircuitSetting?: number;
  breakerInstantaneousSetting?: number;
  breakerGroundFaultSetting?: string; // Can be complex, string for now
  breakerOperationMechanism?: 'Manual' | 'Motorized';
  breakerMotorVoltage?: number;
  breakerShuntTripVoltage?: number;
  breakerUndervoltageRelease?: 'Yes' | 'No';
  breakerAuxiliaryContacts?: string; // e.g., "2NO+2NC"
  protectionInstallationDate?: string;
  // Downtime
  totalDowntimeHours?: number;
  // VSD is not a separate type but its fields are on Equipment
  status: 'active' | 'inactive' | 'maintenance';
  model: string;
  serialNumber: string;
  installationDate: string;
  assignedToId?: string;
  assignedToName?: string;
  protectionAssignedToId?: string;
  protectionAssignedToName?: string;
  // UPS/BTU fields
  upsModel?: string;
  upsSerialNumber?: string;
  batteryType?: string;
  upsInstallationDate?: string;
  lastBatteryReplacement?: string;
  upsAssignedToId?: string;
  upsAssignedToName?: string;
  // Pump fields
  pumpHead?: number;
  flowRate?: number;
  pumpType?: string;
  pumpBrand?: string;
  pumpSerialNumber?: string;
  pumpManufacturer?: string;
  pumpImpellerDiameter?: number;
  pumpCommissionDate?: string;
  pumpFlangeSizeIn?: number;
  pumpFlangeSizeOutlet?: number;
  pumpFrameSize?: string;
  pumpFrameType?: string;
  pumpAssignedToId?: string;
  pumpAssignedToName?: string;
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
  component: 'VSD' | 'Motor' | 'Pump' | 'Protection' | 'UPS' | 'Other';
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

    