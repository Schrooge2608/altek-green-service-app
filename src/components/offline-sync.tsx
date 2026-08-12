'use client';

import { useEffect } from 'react';
import { useUser } from '@/firebase';

/**
 * @fileOverview A silent background component that uses the native browser Cache API
 * to force-download full HTML and JS blueprints for critical offline routes.
 * This ensures the PWA functions correctly even for pages the user hasn't visited yet.
 */

const CRITICAL_ROUTES = [
  '/',
  '/breakdowns',
  '/reports',
  '/time-attendance',
  '/purchase-orders',
  '/assets/tools-equipment',
  '/equipment/mining/boosters',
  '/equipment/mining/dredgers',
  '/equipment/mining/pump-stations',
  '/equipment/mining/ups-btus',
  '/equipment/smelter/msp',
  '/equipment/smelter/roaster',
  '/equipment/smelter/char-plant',
  '/equipment/smelter/smelter',
  '/equipment/smelter/iron-injection',
  '/equipment/smelter/stripping-crane',
  '/equipment/smelter/slag-plant',
  '/equipment/smelter/north-screen',
  '/equipment/smelter/ups-btus',
];

export function OfflineSync() {
  const { user } = useUser();

  useEffect(() => {
    // Only run if the user is authenticated and the browser supports the Cache API
    if (!user || typeof window === 'undefined' || !('caches' in window)) return;

    const syncPages = async () => {
      try {
        console.log('[PWA] Starting aggressive offline cache sync...');
        
        // Target the 'pages' cache defined in next.config.ts
        const cache = await caches.open('pages');
        
        // Cache each route individually. We use a loop instead of addAll 
        // to ensure a single network error doesn't abort the entire set.
        for (const route of CRITICAL_ROUTES) {
          try {
            // Check if we already have a recent version to save bandwidth
            const existing = await cache.match(route);
            if (!existing) {
              await cache.add(route);
              console.log(`[PWA] Document cached: ${route}`);
            }
          } catch (routeErr) {
            console.warn(`[PWA] Could not pre-cache document ${route}:`, routeErr);
          }
        }
        
        console.log('[PWA] Offline blueprints ready.');
      } catch (err) {
        console.error('[PWA] Global Cache Sync failed:', err);
      }
    };

    // Execute with a slight delay to not interfere with primary page hydration
    const timeout = setTimeout(syncPages, 5000);
    return () => clearTimeout(timeout);
  }, [user]);

  // This component is purely functional and renders no UI
  return null;
}
