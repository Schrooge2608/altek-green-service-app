'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import ErrorBoundary from '@/components/layout/error-boundary';
import { OfflineSyncListener } from '@/components/offline-sync-listener';
import { AltekLogo } from '@/components/altek-logo';
import { useUser } from '@/firebase';

interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * MainLayout handles the conditional rendering of the application shell.
 * It hides the Sidebar and SidebarInset when the user is on an authentication page or kiosk.
 */
export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const { user } = useUser();
  
  // Define routes that should not display the navigation sidebar
  const normalizedPath = pathname?.replace(/\/$/, '') || '/';
  const isAuthPage = normalizedPath.startsWith('/auth') || normalizedPath === '/login' || normalizedPath === '/register';
  const isKioskPage = normalizedPath === '/kiosk';

  if (isAuthPage || isKioskPage) {
    return (
      <div className="flex flex-col min-h-screen w-full bg-background overflow-x-hidden">
        <ErrorBoundary>
          <OfflineSyncListener />
          <main className="flex-1 w-full h-full">
            {children}
          </main>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarNav />
      </Sidebar>
      <SidebarInset>
        {/* BULLETPROOF MOBILE HEADER - Large touch targets for site technicians */}
        <header className="md:hidden sticky top-0 z-[50] w-full border-b bg-white p-2 flex items-center justify-between shadow-sm print:hidden">
           <SidebarTrigger />
           <AltekLogo className="h-8 w-auto" />
           <div className="w-12" /> {/* Layout balancer */}
        </header>

        <ErrorBoundary>
          <OfflineSyncListener />
          <div className="flex flex-col flex-1 w-full max-w-full overflow-x-hidden">
            {children}
          </div>
        </ErrorBoundary>
      </SidebarInset>
    </SidebarProvider>
  );
}
