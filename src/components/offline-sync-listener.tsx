'use client';

import { useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { getQueuedImages, removeQueuedImage } from '@/lib/offline-storage';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * An invisible component that listens for 'online' events
 * and triggers the synchronization of the IndexedDB photo queue.
 */
export function OfflineSyncListener() {
  const { firebaseApp, firestore } = useFirebase();
  const { toast } = useToast();

  useEffect(() => {
    const handleSync = async () => {
      if (!navigator.onLine) return;

      const queuedImages = await getQueuedImages();
      if (queuedImages.length === 0) return;

      toast({ 
        title: "Syncing...", 
        description: `Uploading ${queuedImages.length} pending site photos.`,
      });

      for (const item of queuedImages) {
        try {
          // 1. Upload to Storage
          const storage = getStorage(firebaseApp);
          const storagePath = `breakdown_reports/uploads/${Date.now()}_${item.fileName}`;
          const storageRef = ref(storage, storagePath);
          const snapshot = await uploadBytes(storageRef, item.blob);
          const url = await getDownloadURL(snapshot.ref);

          // 2. Update Firestore
          // We parse the ID to find the breakdown record ID
          const recordId = item.id.split('_')[0];
          const recordRef = doc(firestore, 'breakdown_reports', recordId);
          await updateDoc(recordRef, {
            [item.field]: arrayUnion(url)
          });

          // 3. Remove from queue
          await removeQueuedImage(item.id);
        } catch (error) {
          console.error("Failed to sync offline image:", error);
        }
      }

      toast({ 
        title: "Sync Complete", 
        description: "All offline documentation has been uploaded.",
      });
    };

    window.addEventListener('online', handleSync);
    // Initial check in case they are already online
    handleSync();

    return () => window.removeEventListener('online', handleSync);
  }, [firebaseApp, firestore, toast]);

  return null;
}