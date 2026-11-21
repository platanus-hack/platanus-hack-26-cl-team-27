import type { NextConfig } from 'next';

const apiUrl = process.env['API_URL'] ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@team27/ui'],
  typedRoutes: true,
  poweredByHeader: false,
  rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
