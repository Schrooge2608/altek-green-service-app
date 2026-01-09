'use client';
import type { Equipment, VSD } from '@/lib/types';
import { format } from 'date-fns';
import {
  CollectionReference,
  doc,
  writeBatch,
  collection,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

const today = format(new Date(), 'yyyy-MM-dd');
const nextMaintenance = format(
  new Date(new Date().setMonth(new Date().getMonth() + 3)),
  'yyyy-MM-dd'
);

const equipmentData: { equipment: Equipment; vsd: VSD }[] = [
  // This array is now empty as requested.
];

export async function seedDatabase(db: Firestore) {
  if (equipmentData.length === 0) {
    toast({
      variant: 'destructive',
      title: 'No Data to Seed',
      description: 'The equipment data list is empty. Please add data to the seed file first.',
    });
    return;
  }
  const equipmentCol = collection(db, 'equipment') as CollectionReference<Equipment>;
  const vsdCol = collection(db, 'vsds') as CollectionReference<VSD>;

  try {
    const batch = writeBatch(db);
    let count = 0;

    for (const { equipment, vsd } of equipmentData) {
      // Set equipment data
      batch.set(doc(equipmentCol, equipment.id), equipment);

      // Set VSD data
      batch.set(doc(vsdCol, vsd.id), vsd);

      count++;
      // Firestore allows a maximum of 500 operations per batch
      if (count % 499 === 0) {
        await batch.commit();
        // batch = writeBatch(db); // Re-initialize for next set of operations
      }
    }

    // Commit any remaining operations
    await batch.commit();
    toast({
      title: 'Database Seeded!',
      description: `${count} equipment and VSD records have been added.`,
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    toast({
      variant: 'destructive',
      title: 'Database Seeding Failed',
      description:
        'An error occurred while seeding the database. Check the console for details.',
    });
  }
}
