import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { AuthWrapper } from '@/components/layout/auth-wrapper';

export const metadata: Metadata = {
  title: 'Altek Green VSD Data Base',
  description: 'Manage and monitor VSD and equipment data for Altek Green.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <AuthWrapper>
            <SidebarProvider>
              <Sidebar>
                <SidebarNav />
              </Sidebar>
              <SidebarInset>{children}</SidebarInset>
            </SidebarProvider>
            <Toaster />
          </AuthWrapper>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
