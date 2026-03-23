import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Redirect old .html URLs to clean Next.js routes (only migrated pages)
  async redirects() {
    return [
      { source: '/paddlepoint.html', destination: '/', permanent: true },
      { source: '/paddle-events.html', destination: '/events', permanent: true },
      { source: '/paddle-gear.html', destination: '/gear', permanent: true },
      { source: '/paddle-federations.html', destination: '/federations', permanent: true },
      { source: '/paddle-clubs.html', destination: '/clubs', permanent: true },
      { source: '/paddle-weather.html', destination: '/weather', permanent: true },
      { source: '/paddle-conditions.html', destination: '/conditions', permanent: true },
    ];
  },
  // Image optimization for remote logos
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'icons.duckduckgo.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'www.google.com' },
    ],
  },
};

export default nextConfig;
