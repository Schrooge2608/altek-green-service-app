
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

    // If a logged-in user tries to access a public-only page, redirect them.
    if (user && publicRoutes.includes(pathname)) {
        // Exception: admins can access /auth/register to see the form, even if it redirects for them.
        // We handle the "Add User" flow on a different page now, but this is a safeguard.
      if (!pathname.startsWith('/admin')) {
        router.push('/');
        return;
      }
    }

    // If the user is not logged in and the current route is not public, redirect to the login page.
    if (!user && !publicRoutes.includes(pathname)) {
      router.push('/auth/register');
    }
  }, [user, isUserLoading, router, pathname]);

  // While checking auth status, show a full-page loader to prevent
  // any of the child components from attempting to fetch data, unless on a public route.
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
