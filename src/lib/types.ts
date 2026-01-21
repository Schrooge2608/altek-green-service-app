
export interface Equipment {
  id: string;
  name: string;
  location: string;
  plant: 'Mining' | 'Smelter';
  division?: 'Boosters' | 'Dredgers' | 'Pump Stations' | 'MSP' | 'Roaster' | 'Char Plant' | 'Smelter' | 'Iron injection' | 'Stripping Crane' | 'Slag plant' | 'North Screen' | "UPS/BTU's";
  vsdId: string;
  lastMaintenance: string;
  nextMaintenance: string;
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
  totalDowntimeHours?: number; // Represents current month's downtime
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
  // Gearbox fields
  gearboxModel?: string;
  gearboxBrand?: string;
  gearboxRatio?: string;
  gearboxSerialNumber?: string;
  gearboxOilType?: string;
  gearboxOilCapacityLiters?: number;
  gearboxAssignedToId?: string;
  gearboxAssignedToName?: string;
  // Fan fields
  fanType?: string;
  fanBrand?: string;
  fanModel?: string;
  fanSerialNumber?: string;
  fanAirflowCFM?: number;
  fanBladeDiameter?: number;
  fanAssignedToId?: string;
  fanAssignedToName?: string;
  // Valve fields
  valveType?: string;
  valveBrand?: string;
  valveModel?: string;
  valveSerialNumber?: string;
  valveSizeInches?: number;
  valveActuatorType?: string;
  valveAssignedToId?: string;
  valveAssignedToName?: string;
  breakdownStatus?: 'None' | 'Active' | 'Resolved' | 'Pending PO' | 'Awaiting OT' | 'Signed Off' | 'Invoiced';
}

export interface VSD {
  id: string;
  driveType: 'VSD' | 'Soft Starter';
  serialNumber: string;
  equipmentId: string;
  model: string;
  manufacturer?: string;
  installationDate: string;
  status: 'active' | 'inactive' | 'maintenance';
  assignedToId?: string;
  assignedToName?: string;
}

export interface MaintenanceTask {
  id: string;
  equipmentId: string;
  equipmentName: string;
  component: 'VSD' | 'Protection' | 'Motor' | 'Pump' | 'UPS';
  task: string;
  dueDate: string;
  frequency: 'Weekly' | 'Monthly' | '3-Monthly' | '6-Monthly' | 'Yearly';
  status: 'pending' | 'completed' | 'overdue';
  assignedToId: string;
  assignedToName: string;
}

export interface ScheduledTask {
  id: string;
  originalTaskId: string;
  equipmentId: string;
  equipmentName: string;
  task: string;
  scheduledFor: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  assignedToId: string;
  assignedToName: string;
  completionNotes?: string;
  component: MaintenanceTask['component'];
  frequency: MaintenanceTask['frequency'];
  workCrew?: WorkCrewMember[];
  checklist?: ChecklistItem[];
  take5Scans?: string[];
  cccScans?: string[];
  jhaScans?: string[];
  ptwScans?: string[];
  workOrderScans?: string[];
  updatedAt?: string;
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
  images?: string[];
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
  role: 'Admin' | 'Client Manager' | 'Corporate Manager' | 'Corporate Manager (Beta)' | 'Data Admin' | 'Data Admin (Beta)' | 'HVAC product specialist' | 'HVAC product specialist (Beta)' | 'Junior Technician' | 'Junior Technician (Beta)' | 'Power systems engineer' | 'Power systems engineer (Beta)' | 'Services Manager' | 'Services Manager (Beta)' | 'Site Supervisor' | 'Site Supervisor (Beta)' | 'Superadmin' | 'Technician' | 'Technician (Beta)' | 'Technologist' | 'Technologist (Beta)';
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

export interface ManpowerEntry {
    designation?: string;
    forecast?: number;
    actual?: number;
    normalHrs?: number;
    overtime1_5?: number;
    overtime2_0?: number;
    totalManHrs?: number;
    comments?: string;
}

export interface PlantEntry {
    description?: string;
    qty?: number;
    inspectionDone?: 'yes' | 'no';
    comments?: string;
}

export interface WorkEntry {
    area?: string;
    scope?: string;
    timeStart?: string;
    timeEnd?: string;
    hrs?: number;
}


export interface DailyDiary {
  id: string;
  userId: string;
  contractTitle: string;
  contractNumber: string;
  area: 'Mining' | 'Smelter';
  date: string;
  shiftStart?: string;
  shiftEnd?: string;
  hrs?: number;
  incidents?: string;
  toolboxTalk?: string;
  hseDocumentationScans?: string[];
  manpower?: ManpowerEntry[];
  plant?: PlantEntry[];
  works?: WorkEntry[];
  delays?: string[];
  comments?: string[];
  contractorName?: string;
  contractorSignature?: string; // base64
  contractorDate?: string;
  clientName?: string;
  clientSignature?: string; // base64
  clientDate?: string;
  beforeWorkImages?: string[];
  afterWorkImages?: string[];
  isSignedOff: boolean;
  createdAt?: any;
}

export interface PerformanceRecord {
  id: string;
  equipmentId: string;
  period: string; // e.g., '2024-07'
  uptime: number;
  downtimeHours: number;
  powerConsumption: number;
}

export interface TimesheetEntry {
    date: string;
    timeIn?: string;
    lunchOut?: string;
    lunchIn?: string;
    timeOut?: string;
    normalHrs?: number;
    overtimeHrs?: number;
    overtimeReason?: string;
    signature?: string | null;
    comments?: string;
}

export interface Timesheet {
    id: string; // {userId}_{period}
    userId: string;
    userName: string;
    period: string; // YYYY-MM
    entries: TimesheetEntry[];
}

export interface GeneratedReport {
  id: string;
  reportText: string;
  startDate: string;
  endDate: string;
  generatedAt: any; // Firestore Timestamp
  generatedByUserId: string;
  generatedByUserName: string;
}
