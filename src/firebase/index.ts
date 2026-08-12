
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { DependencyList, useMemo } from 'react';

const firebaseConfig = {
  apiKey: "AIzaSyCYugYlB7XHdQxB6GQ3omRv9a0n7fBG6Yg",
  projectId: "studio-8966443065-8fafa",
  storageBucket: "studio-8966443065-8fafa.firebasestorage.app",
  messagingSenderId: "1080999162704",
  appId: "1:1080999162704:web:7d15f613f892c50fc7f255",
};

/**
 * Module-level variables to ensure singleton status across hot-reloads in Next.js.
 * This prevents multiple attempts to initialize Firestore persistence on the same app.
 */
let cachedApp: FirebaseApp | undefined;
let cachedFirestore: Firestore | undefined;
let cachedAuth: Auth | undefined;
let cachedStorage: FirebaseStorage | undefined;

export function initializeFirebase() {
  // 1. Initialize or Retrieve Firebase App
  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }

  // 2. Initialize or Retrieve Firestore with Multi-Tab Persistence
  if (!cachedFirestore) {
    try {
      // ENABLE OFFLINE PERSISTENCE:
      // persistentMultipleTabManager() allows multiple tabs to share the same IndexedDB cache safely.
      cachedFirestore = initializeFirestore(cachedApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (e) {
      // If Firestore was already initialized (e.g., during a hot reload), 
      // initializeFirestore throws an error. We catch it and get the existing instance.
      cachedFirestore = getFirestore(cachedApp);
    }
  }

  // 3. Initialize or Retrieve Auth and Storage
  if (!cachedAuth) cachedAuth = getAuth(cachedApp);
  if (!cachedStorage) cachedStorage = getStorage(cachedApp);

  return {
    firebaseApp: cachedApp,
    auth: cachedAuth,
    firestore: cachedFirestore,
    storage: cachedStorage
  };
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp)
  };
}

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
