import type { NextConfig } from 'next';

const railsApiUrl = process.env.RAILS_API_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },

  // Rails APIへの転送設定
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${railsApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
