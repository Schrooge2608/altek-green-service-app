'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// List of routes that do not require authentication
const publicRoutes = ['/auth/register'];

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If auth state is still loading, do nothing yet.
    if (isUserLoading) {
      return;
    }

    // If the user is not logged in and the current route is not public
    if (!user && !publicRoutes.includes(pathname)) {
      router.push('/auth/register');
    }
  }, [user, isUserLoading, router, pathname]);

  // While checking auth status, show a full-page loader to prevent
  // any of the child components from attempting to fetch data.
  if (isUserLoading && !publicRoutes.includes(pathname)) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If user is not logged in but is on a public route, allow it.
  if (!user && publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }
  
  // If user is logged in, show the content.
  if (user) {
      return <>{children}</>;
  }

  // Fallback for the brief period during redirect
  return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
}
