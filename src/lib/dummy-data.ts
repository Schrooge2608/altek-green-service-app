
import type { User } from './types';

const rbmInfo = {
  designatedLeaderName: "RBM Leader",
  responsibleGenManager: "RBM General Manager",
  department: "RBM Department",
  section: "RBM Section",
  purchaseOrderNo: "PO-12345",
  startingDate: "2024-01-01",
  endDate: "2025-01-01",
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
