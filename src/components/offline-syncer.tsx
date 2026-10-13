'use client';

/**
 * OfflineSyncer - Neutralized background crawler.
 * Previously, this ran a loop after 30 seconds downloading all equipment pages via
 * `pagesCache.add(...)`, which saturated browser connection slots and network bandwidth,
 * causing the entire application to buffer for 20-30 seconds on user navigations.
 *
 * Firestore offline persistence (`persistentLocalCache` with IndexedDB) already stores
 * all equipment and application data locally for offline use.
 */
export function OfflineSyncer() {
  return null;
}
