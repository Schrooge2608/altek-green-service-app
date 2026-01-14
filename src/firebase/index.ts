'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { DependencyList, useMemo } from 'react';

// Hardcoded Firebase configuration to ensure the correct project is used.
const firebaseConfig = {
  apiKey: "AIzaSyCYugYlB7XHdQxB6GQ3omRv9a0n7fBG6Yg",
  authDomain: "studio-8966443065-8fafa.firebaseapp.com",
  projectId: "studio-8966443065-8fafa",
  storageBucket: "studio-8966443065-8fafa.appspot.com",
  messagingSenderId: "1080999162704",
  appId: "1:1080999162704:web:7d15f613f892c50fc7f255",
};

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Initialize with the hardcoded config to prevent any ambiguity.
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
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
