
import type { User } from './types';

const rbmInfo = {
  designatedLeaderName: "RBM Leader",
  responsibleGenManager: "RBM General Manager",
  department: "RBM Department",
  section: "RBM Section",
  purchaseOrderNo: "PO-12345",
  startingDate: "2025-09-01",
  endDate: "2028-08-31",
  justification: "Standard RBM contract.",
};

export const dummyUsers: Omit<User, 'id'>[] = [
  // Technicians
  { name: 'John Doe', email: 'john.doe@altek.com', role: 'Technician', ...rbmInfo },
  { name: 'Jane Smith', email: 'jane.smith@altek.com', role: 'Technician', ...rbmInfo },
  { name: 'Peter Jones', email: 'peter.jones@altek.com', role: 'Technician', ...rbmInfo },
  { name: 'Mary Williams', email: 'mary.williams@altek.com', role: 'Technician', ...rbmInfo },
  { name: 'David Brown', email: 'david.brown@altek.com', role: 'Technician', ...rbmInfo },
  { name: 'Susan Davis', email: 'susan.davis@altek.com', role: 'Technician', ...rbmInfo },

  // Junior Technician
  { name: 'Chris Green', email: 'chris.green@altek.com', role: 'Junior Technician', ...rbmInfo },

  // Technologist
  { name: 'Brenda White', email: 'brenda.white@altek.com', role: 'Technologist', ...rbmInfo },

  // Power systems engineer
  { name: 'Edward Black', email: 'edward.black@altek.com', role: 'Power systems engineer', ...rbmInfo },

  // HVAC product specialist
  { name: 'Nancy Hill', email: 'nancy.hill@altek.com', role: 'HVAC product specialist', ...rbmInfo },

  // Site Supervisors
  { name: 'Michael Miller', email: 'michael.miller@altek.com', role: 'Site Supervisor', ...rbmInfo },
  { name: 'Patricia Wilson', email: 'patricia.wilson@altek.com', role: 'Site Supervisor', ...rbmInfo },

  // Services Manager
  { name: 'Robert Moore', email: 'robert.moore@altek.com', role: 'Services Manager', ...rbmInfo },

  // Corporate Manager
  { name: 'Linda Taylor', email: 'linda.taylor@altek.com', role: 'Corporate Manager', ...rbmInfo },
  
  // Admin
  { name: 'Admin User', email: 'admin@altek.com', role: 'Admin', ...rbmInfo },
];

