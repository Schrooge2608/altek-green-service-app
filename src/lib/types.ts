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
  breakerGroundFaultSetting?: string; 
  breakerOperationMechanism?: 'Manual' | 'Motorized';
  breakerMotorVoltage?: number;
  breakerShuntTripVoltage?: number;
  breakerUndervoltageRelease?: 'Yes' | 'No';
  breakerAuxiliaryContacts?: string; 
  protectionInstallationDate?: string;
  // Downtime
  totalDowntimeHours?: number; 
  // VSD
  status: 'active' | 'inactive' | 'maintenance';
  model: string;
  serialNumber: string;
  installationDate: string;
  assignedToId?: string;
  assignedToName?: string;
  protectionAssignedToId?: string;
  protectionAssignedToName?: string;
  // UPS/BTU fields
  upsType?: 'UPS' | 'BTU' | 'Industrial UPS' | 'BTU Unit' | 'Unspecified' | string;
  upsBrand?: string;
  upsModel?: string;
  upsSerialNumber?: string;
  batteryType?: string;
  batteryQuantity?: number;
  batteryExpiryDate?: string;
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
  powerConsumption?: number;
  uptime?: number;
}

export interface VSD {
  id: string;
  driveType: 'VSD' | 'Soft Starter';
  serialNumber: string;
  dsuLeftSerialNumber?: string;
  dsuRightSerialNumber?: string;
  inverterLeftSerialNumber?: string;
  inverterRightSerialNumber?: string;
  moduleLeft1SerialNumber?: string;
  moduleLeft2SerialNumber?: string;
  moduleLeft3SerialNumber?: string;
  moduleRight1SerialNumber?: string;
  moduleRight2SerialNumber?: string;
  moduleRight3SerialNumber?: string;
  capacitorChangeDate?: string;
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
  area?: string;
  task: string;
  scheduledFor: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | 'Approved';
  assignedToId: string;
  assignedToName: string;
  completionNotes?: string;
  comments?: string;
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
  techSignature?: string | null;
  techName?: string | null;
  techSignatureDate?: string;
  clientSignature?: string | null;
  clientName?: string | null;
  clientSignatureDate?: string;
  managerComments?: string;
}

export interface Breakdown {
  id: string;
  userId?: string;
  equipmentId: string;
  equipmentName: string;
  component: 'VSD' | 'Motor' | 'Pump' | 'Protection' | 'UPS' | 'Other';
  date: string;
  description: string;
  resolved: boolean;
  resolution?: string | null;
  normalHours?: number;
  overtimeHours?: number;
  timeReported?: string;
  timeArrived?: string | null;
  timeBackInService?: string | null;
  timeLeftSite?: string | null;
  hasDelays?: boolean;
  delayReason?: string | null;
  images?: string[];
  safetyDocs?: string[];
  purchaseOrderNumber?: string | null;
  // Signature Fields
  techSignature?: string | null;
  techName?: string | null;
  clientName?: string | null;
  clientSignature?: string | null;
  // MC Signatures (Site Maintenance Controller)
  mcName?: string | null;
  mcSignature?: string | null;
  // Final Manager Signatures
  managerName?: string | null;
  managerSignature?: string | null;
  // Status and Handover Fields
  status?: 'In Progress' | 'Handed Over' | 'Resolved' | 'Closed' | 'Pending Assignment';
  linkedToReportId?: string;
  isContinuation?: boolean;
  isLocked?: boolean;
  createdAt?: any;
  updatedAt?: any;
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
  rtbsNumber?: string;
  qualifications?: string;
  designatedLeaderName?: string;
  responsibleGenManager?: string;
  department?: string;
  section?: string;
  purchaseOrderNo?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  justification?: string;
  signatureUrl?: string;
  avatarUrl?: string;
  signingPin?: string;
  activeUserContext?: string | null;
  kioskSession?: boolean | null;
  clientId?: string;
  timesheetEnabled?: boolean;
}

export interface StandbyShift {
  id: string;
  startDate: string;
  endDate: string;
  primaryTech: string;
  backupTech?: string;
  isMineTeamWeek?: boolean;
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
  diaryReference?: string;
  userId: string;
  contractTitle: string;
  contractNumber: string;
  workType?: 'Normal' | 'Callout';
  purchaseOrderNumber?: string;
  quotationNumber?: string;
  area: 'Mining' | 'Smelter';
  date: string | Date;
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
  contractorSignature?: string | null; // base64
  contractorDate?: string;
  clientName?: string;
  clientSignature?: string | null; // base64
  clientDate?: string;
  isSignedOff: boolean;
  isFinalised: boolean;
  createdAt?: any;
  locationFilter?: string | null;
  savedEquipmentId?: string | null;
  equipmentNames?: string[];
}

export interface FieldServiceReport {
  id: string;
  userId: string;
  fsrReference: string;
  date: string;
  jobType: 'Technical' | 'Documentation' | 'Customer Sign-Off';
  // 01 Customer & Job
  area?: 'Mining' | 'Smelter';
  customer: string;
  site: string;
  poNumber: string;
  serviceEntryNo: string;
  contactPerson: string;
  contactNumber: string;
  city: string;
  email: string;
  jobCategory: 'Planned' | 'Unplanned' | 'Breakdown' | 'PM';
  // 02 Equipment
  assetName: string;
  tagNo: string;
  serialNo: string;
  location: string;
  oem: string;
  model: string;
  year: string;
  rating: string;
  // 03 Time & Travel
  timeCallOut: string;
  timeArrival: string;
  timeStart: string;
  timeEnd: string;
  timeDeparture: string;
  ntHours: number;
  otHours: number;
  dtHours: number;
  travelKmTo: number;
  travelKmReturn: number;
  totalHours: number;
  totalKm: number;
  // 04 & 05
  customerFault: string;
  techFindings: string;
  rca: string;
  correctiveActions: string;
  recommendations: string;
  // 06 Parts
  parts: FSRPart[];
  // 07 Personnel
  personnel: FSRPersonnel[];
  // 08 HSE
  hse: FSRHse;
  // 09 Sign-Off
  techName: string;
  techEmpNo: string;
  techSignature: string | null;
  techSignDate: string;
  clientName: string;
  clientDesignation: string;
  clientSignature: string | null;
  clientSignDate: string;
  status: 'Draft' | 'Finalized';
  images?: string[];
  createdAt: any;
  updatedAt: any;
}

export interface FSRPart {
  partNo: string;
  description: string;
  qty: number;
  unit: string;
  suppliedBy: string;
  remarks: string;
}

export interface FSRPersonnel {
  name: string;
  role: string;
  hrs: number;
  ot: number;
}

export interface FSRHse {
  ppe: 'Yes' | 'No' | 'NA';
  riskAssessment: 'Yes' | 'No' | 'NA';
  permit: 'Yes' | 'No' | 'NA';
  incidents: 'Yes' | 'No' | 'NA';
  areaCleaned: 'Yes' | 'No' | 'NA';
  environmentalImpact: 'Yes' | 'No' | 'NA';
  observations: string;
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
    normalIn?: string;
    normalOut?: string;
    lunchOut?: string;
    lunchIn?: string;
    calloutIn?: string;
    calloutOut?: string;
    calculatedNT?: number;
    calculatedOT15?: number;
    calculatedOT20?: number;
    overtimeReason?: string;
    signature?: string | null;
    comments?: string;
    isFlagged?: boolean;
    location_warning?: boolean;
    distanceKm?: string | null;
    gpsLat?: number;
    gpsLon?: number;
    managerOverride?: boolean;
    roster_verified?: boolean;
    actual_clock_time?: string;
    isOutOfRange?: boolean;
    distanceFromSite?: string | null;
}

export interface Timesheet {
    id: string; // {userId}_{period}
    userId: string;
    userName: string;
    period: string; // YYYY-MM
    entries: TimesheetEntry[];
    adminOverrides?: Record<string, 'QUALIFIED' | 'DISQUALIFIED' | null>;
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

export interface Channel {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: any; // Timestamp
  participants: string[];
  createdAt?: any;
  type?: 'breakdown' | 'general' | string;
  relatedId?: string;
  isArchived?: boolean;
  archivedAt?: any;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: any; // serverTimestamp
  photoUrl?: string;
}

export interface Consumable {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  category?: string;
}

export interface IPRItem {
  consumableId: string;
  name: string;
  requestedQty: number;
  issuedQty: number;
}

export interface IPRRequest {
  id: string;
  userId: string;
  userName: string;
  date: string;
  status: 'Pending' | 'Issued' | 'Cancelled';
  items: IPRItem[];
  technicianSignature?: string | null;
  technicianSignatureDate?: string;
  issuerName?: string;
  issuedDate?: string;
}

export interface RosterOverride {
  id: string;
  techName: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  calloutDate: string;
  description?: string;
  fileUrl: string;
  uploadedBy: string;
  uploadedByUid: string;
  uploadedAt: string;
  status: 'Active' | 'Cancelled';
}

export interface OrganogramPosition {
  id: string;
  roleTitle: string;
  userId: string | null;
  tier: number;
}

export interface Client {
  id: string;
  companyName: string;
  billingAddress: string;
  vatNumber: string;
  contactPerson: string;
  email: string;
  phone: string;
  slaContractNumber?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  designatedLeader?: string;
  responsibleManager?: string;
  department?: string;
  section?: string;
  justification?: string;
  slaUrl?: string;
  slaFileName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SafetyMeeting {
  id: string;
  date: string;
  time: string;
  conductorName: string;
  conductorId: string;
  conductorSignature: string | null;
  agendaTopics: string[];
  orangeBanners: { name: string; url: string }[];
  attendance: {
    userId: string;
    userName: string;
    role: string;
    isPresent: boolean;
  }[];
  status: 'draft' | 'finalized';
  createdAt: any;
}

export interface Asset {
  id: string;
  assetsNewNumber: string;
  assetType: string;
  assetDescription: string;
  make: string;
  model: string;
  serialNumber: string;
  company: string;
  site: string;
  user?: string;
  cost?: number;
  purchaseDate?: string;
  status: 'Available' | 'In Use' | 'In Store' | 'Maintenance' | 'Lost';
  lostReason?: string;
  createdAt?: any;
}
