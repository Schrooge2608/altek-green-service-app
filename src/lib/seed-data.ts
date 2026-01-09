
import type { Equipment, VSD } from './types';
import { format } from 'date-fns';
import { doc } from 'firebase/firestore';

const today = new Date();
const installationDate = format(new Date('2023-01-01'), "yyyy-MM-dd");

export const seedEquipment: Equipment[] = [
    {
        id: "dm-mpc-wbp-01",
        name: "MPC Water Booster Pump",
        type: "Pump",
        location: "MPC DRY MINING",
        plant: "Mining",
        division: "Dredgers",
        vsdId: "vsd-dm-mpc-wbp-01",
        model: "Siemens Sinamics G150",
        serialNumber: "SN-DM-MPC-WBP-01",
        status: "active",
        installationDate: installationDate,
        lastMaintenance: format(today, "yyyy-MM-dd"),
        nextMaintenance: format(new Date(new Date().setMonth(today.getMonth() + 3)), "yyyy-MM-dd"),
        uptime: 99.8,
        powerConsumption: 45000,
    },
    {
        id: "dm-mpc-sp-01",
        name: "MPC Slurry Pump",
        type: "Pump",
        location: "MPC DRY MINING",
        plant: "Mining",
        division: "Dredgers",
        vsdId: "vsd-dm-mpc-sp-01",
        model: "Siemens Sinamics G150",
        serialNumber: "SN-DM-MPC-SP-01",
        status: "active",
        installationDate: installationDate,
        lastMaintenance: format(today, "yyyy-MM-dd"),
        nextMaintenance: format(new Date(new Date().setMonth(today.getMonth() + 3)), "yyyy-MM-dd"),
        uptime: 99.5,
        powerConsumption: 52000,
    },
    {
        id: "dm-mpe-wbp-01",
        name: "MPE Water Booster Pump",
        type: "Pump",
        location: "MPC DRY MINING", 
        plant: "Mining",
        division: "Dredgers",
        vsdId: "vsd-dm-mpe-wbp-01",
        model: "Siemens Sinamics G150",
        serialNumber: "SN-DM-MPE-WBP-01",
        status: "active",
        installationDate: installationDate,
        lastMaintenance: format(today, "yyyy-MM-dd"),
        nextMaintenance: format(new Date(new Date().setMonth(today.getMonth() + 3)), "yyyy-MM-dd"),
        uptime: 99.7,
        powerConsumption: 46000,
    },
    {
        id: "dm-mpe-sp-01",
        name: "MPE Slurry Pump",
        type: "Pump",
        location: "MPC DRY MINING",
        plant: "Mining",
        division: "Dredgers",
        vsdId: "vsd-dm-mpe-sp-01",
        model: "Siemens Sinamics G150",
        serialNumber: "SN-DM-MPE-SP-01",
        status: "active",
        installationDate: installationDate,
        lastMaintenance: format(today, "yyyy-MM-dd"),
        nextMaintenance: format(new Date(new Date().setMonth(today.getMonth() + 3)), "yyyy-MM-dd"),
        uptime: 99.6,
        powerConsumption: 53000,
    },
];


export const seedVsds: VSD[] = seedEquipment.map(eq => ({
    id: eq.vsdId,
    serialNumber: eq.serialNumber,
    equipmentId: eq.id,
    model: eq.model,
    installationDate: eq.installationDate,
    status: eq.status,
    assignedToId: eq.assignedToId,
    assignedToName: eq.assignedToName,
}));


export async function seedDatabase(firestore: any) {
  const { collection, writeBatch, doc } = await import('firebase/firestore');

  const batch = writeBatch(firestore);

  const equipmentCollection = collection(firestore, 'equipment');
  seedEquipment.forEach(equipmentDoc => {
    const { id, ...data } = equipmentDoc;
    const docRef = doc(equipmentCollection, id);
    batch.set(docRef, data);
  });

  const vsdCollection = collection(firestore, 'vsds');
  seedVsds.forEach(vsdDoc => {
    const { id, ...data } = vsdDoc;
    const docRef = doc(vsdCollection, id);
    batch.set(docRef, data);
  });

  try {
    await batch.commit();
    alert('Dry Mining equipment data has been successfully seeded!');
  } catch (error) {
    console.error('Error seeding data: ', error);
    alert('An error occurred while seeding the data. Check the console for details.');
  }
}
