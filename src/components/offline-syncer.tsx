'use client';

import { useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query } from 'firebase/firestore';

export function OfflineSyncer() {
  const firestore = useFirestore();
  const hasRun = useRef(false);

  useEffect(() => {
    // Only run on the client, and only once per session
    if (typeof window === 'undefined' || !firestore || hasRun.current) return;
    hasRun.current = true;

    // We only want to auto-sync once every 24 hours to save bandwidth
    const SYNC_INTERVAL = 24 * 60 * 60 * 1000; 

    const runSync = async () => {
      try {
        if (!navigator.onLine) return;

        const lastSync = localStorage.getItem('lastOfflineSync');
        if (lastSync && Date.now() - parseInt(lastSync) < SYNC_INTERVAL) {
          return; // Already synced recently
        }

        // Wait 10 seconds to let the main app finish loading completely 
        // so we don't slow down the user's initial experience
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        if (!('caches' in window)) return;
        
        // 'pages' is the cache name configured in next-pwa for HTML navigations
        const pagesCache = await caches.open('pages');
        
        // 1. Fetch all equipment IDs
        const eqQuery = query(collection(firestore, 'equipment'));
        const eqSnapshot = await getDocs(eqQuery);
        const eqUrls = eqSnapshot.docs.map(doc => `/equipment/${doc.id}`);

        const urlsToCache = [...eqUrls];
        
        // 2. Download and cache them in small batches
        const BATCH_SIZE = 3;
        for (let i = 0; i < urlsToCache.length; i += BATCH_SIZE) {
          const batch = urlsToCache.slice(i, i + BATCH_SIZE);
          // Use Promise.allSettled so one failure doesn't stop the whole sync
          await Promise.allSettled(
            batch.map(url => pagesCache.add(url).catch(e => console.warn('Failed to cache:', url, e)))
          );
        }

        // Save the timestamp so we don't do this again for 24 hours
        localStorage.setItem('lastOfflineSync', Date.now().toString());
        console.log(`[Offline Sync] Successfully cached ${urlsToCache.length} asset pages for offline use.`);
      } catch (error) {
        console.error('[Offline Sync] Failed to sync:', error);
      }
    };

    runSync();
  }, [firestore]);

  return null;
}
