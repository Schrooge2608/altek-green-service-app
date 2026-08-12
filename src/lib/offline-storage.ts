'use client';

/**
 * @fileOverview Specialized storage for handling offline image uploads.
 * Firestore handles its own persistence, but Firebase Storage requires 
 * manual queuing for network-resilient uploads.
 */

const DB_NAME = 'AltekOfflineStorage';
const STORE_NAME = 'ImageUploadQueue';
const DB_VERSION = 1;

export interface QueuedImage {
  id: string; // Document ID (Breakdown ID)
  blob: Blob;
  fileName: string;
  field: string; // Field in Firestore to update (e.g., 'images')
  createdAt: number;
}

export async function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueImageForSync(item: QueuedImage): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getQueuedImages(): Promise<QueuedImage[]> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueuedImage(id: string): Promise<void> {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}