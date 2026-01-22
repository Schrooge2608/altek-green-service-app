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