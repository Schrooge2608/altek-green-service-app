
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';

interface KioskContextType {
  activeKioskUser: User | null;
  loginKioskUser: (user: User) => void;
  logoutKioskUser: () => void;
  isKioskMode: boolean;
}

const KioskContext = createContext<KioskContextType | undefined>(undefined);

export function KioskProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [activeKioskUser, setActiveKioskUser] = useState<User | null>(null);
  const [isKioskMode, setIsKioskMode] = useState(false);

  // Fetch role of the "master" user logged in to the browser
  const masterUserRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: masterUserData } = useDoc<User>(masterUserRef);

  // FETCH TARGET USER ONLY (Source of Truth for Cross-Device Support)
  const kioskUserRef = useMemoFirebase(() => {
    if (!user || !masterUserData?.activeUserContext) return null;
    return doc(firestore, 'users', masterUserData.activeUserContext);
  }, [firestore, user, masterUserData?.activeUserContext]);
  
  const { data: dbKioskUser, isLoading: dbKioskUserLoading } = useDoc<User>(kioskUserRef);

  // 1. Initial Load from Storage (local cache)
  useEffect(() => {
    const savedUser = localStorage.getItem('activeKioskUser');
    const kioskFlag = localStorage.getItem('isKioskMode') === 'true';
    
    if (savedUser) {
      try {
        setActiveKioskUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse saved kiosk user");
      }
    }
    setIsKioskMode(kioskFlag);
  }, []);

  // 2. Sync from Firestore (Verification and Restoration)
  useEffect(() => {
    if (user && masterUserData && !isUserLoading && !dbKioskUserLoading) {
      const isElevated = ['Admin', 'Superadmin', 'Services Manager', 'Site Supervisor', 'Corporate Manager', 'Data Admin'].includes(masterUserData.role || '');

      // GHOST EVICTION: If David is a regular tech, he CANNOT have a kiosk session
      if (!isElevated && (masterUserData.activeUserContext || localStorage.getItem('activeKioskUser'))) {
        const userRef = doc(firestore, 'users', user.uid);
        updateDoc(userRef, {
          activeUserContext: null,
          kioskSession: null
        }).catch(() => {});
        
        setActiveKioskUser(null);
        setIsKioskMode(false);
        localStorage.removeItem('activeKioskUser');
        localStorage.removeItem('isKioskMode');
        return;
      }

      // RESTORATION LOGIC: For Admins switching devices
      if (isElevated && masterUserData.activeUserContext && dbKioskUser) {
        if (!activeKioskUser || activeKioskUser.id !== masterUserData.activeUserContext) {
          setActiveKioskUser(dbKioskUser);
          setIsKioskMode(true);
          localStorage.setItem('activeKioskUser', JSON.stringify(dbKioskUser));
          localStorage.setItem('isKioskMode', 'true');
        }
      }
    }
  }, [masterUserData, dbKioskUser, dbKioskUserLoading, isUserLoading, activeKioskUser, user, firestore]);

  // 3. CRITICAL: Cleanup on Auth Change
  useEffect(() => {
    if (!isUserLoading && !user) {
      setActiveKioskUser(null);
      setIsKioskMode(false);
      localStorage.removeItem('activeKioskUser');
      localStorage.removeItem('isKioskMode');
      return;
    }
  }, [user, isUserLoading]);

  const loginKioskUser = (userToLogin: User) => {
    setActiveKioskUser(userToLogin);
    setIsKioskMode(true);
    localStorage.setItem('activeKioskUser', JSON.stringify(userToLogin));
    localStorage.setItem('isKioskMode', 'true');
    
    // PERSIST TO DATABASE (Master User Document)
    if (user) {
      const userRef = doc(firestore, 'users', user.uid);
      updateDoc(userRef, {
        activeUserContext: userToLogin.id,
        kioskSession: true
      });
    }
  };

  const logoutKioskUser = () => {
    setActiveKioskUser(null);
    setIsKioskMode(false);
    localStorage.removeItem('activeKioskUser');
    localStorage.removeItem('isKioskMode');
    
    // CLEAR FROM DATABASE
    if (user) {
      const userRef = doc(firestore, 'users', user.uid);
      updateDoc(userRef, {
        activeUserContext: null,
        kioskSession: null
      });
    }
  };

  return (
    <KioskContext.Provider value={{ activeKioskUser, loginKioskUser, logoutKioskUser, isKioskMode }}>
      {children}
    </KioskContext.Provider>
  );
}

export const useKiosk = () => {
  const context = useContext(KioskContext);
  if (context === undefined) {
    throw new Error('useKiosk must be used within a KioskProvider');
  }
  return context;
};
