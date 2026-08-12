
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { AuthWrapper } from '@/components/layout/auth-wrapper';
import { MainLayout } from '@/components/layout/main-layout';
import { KioskProvider } from '@/components/kiosk/kiosk-provider';

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: 'Altek Green',
  description: 'Altek Green Plant Maintenance System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Altek Green',
  },
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Poppins:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <KioskProvider>
            <AuthWrapper>
              <MainLayout>
                {children}
              </MainLayout>
              <Toaster />
            </AuthWrapper>
          </KioskProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
