import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: "public",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        // TARGET NAVIGATION: Ensure full HTML snapshots are served when offline
        urlPattern: ({ request }: any) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 86400,
          },
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'next-data',
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 86400,
          },
        },
      },
      {
        urlPattern: /\/_next\/static\/.+\.js$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static-js',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 86400 * 30, // 30 days
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 31536000,
          },
        },
      },
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-font-assets",
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 604800,
          },
        },
      },
      {
        urlPattern: /\/equipment\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'equipment-pages',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 86400,
          },
          networkTimeoutSeconds: 5,
        },
      },
      {
        urlPattern: /\/time-attendance.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'time-attendance-pages',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 86400,
          },
          networkTimeoutSeconds: 5,
        },
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-image-assets",
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 86400,
          },
        },
      },
      {
        urlPattern: /.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'others',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 86400,
          },
          networkTimeoutSeconds: 10,
        },
      },
    ],
  },
});

// For Next 15 Turbopack compatibility: only wrap with PWA plugin in production.
export default process.env.NODE_ENV === "development" ? nextConfig : withPWA(nextConfig);
