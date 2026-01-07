import type { User } from './types';

export const dummyUsers: Omit<User, 'id'>[] = [
  // Technicians
  { name: 'John Doe', email: 'john.doe@altek.com', role: 'Technician' },
  { name: 'Jane Smith', email: 'jane.smith@altek.com', role: 'Technician' },
  { name: 'Peter Jones', email: 'peter.jones@altek.com', role: 'Technician' },
  { name: 'Mary Williams', email: 'mary.williams@altek.com', role: 'Technician' },
  { name: 'David Brown', email: 'david.brown@altek.com', role: 'Technician' },
  { name: 'Susan Davis', email: 'susan.davis@altek.com', role: 'Technician' },

  // Site Supervisors
  { name: 'Michael Miller', email: 'michael.miller@altek.com', role: 'Site Supervisor' },
  { name: 'Patricia Wilson', email: 'patricia.wilson@altek.com', role: 'Site Supervisor' },

  // Services Manager
  { name: 'Robert Moore', email: 'robert.moore@altek.com', role: 'Services Manager' },

  // Corporate Manager
  { name: 'Linda Taylor', email: 'linda.taylor@altek.com', role: 'Corporate Manager' },
  
  // Admin
  { name: 'Admin User', email: 'admin@altek.com', role: 'Admin' },
];
