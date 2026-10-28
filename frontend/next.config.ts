import type { NextConfig } from 'next';

const railsApiUrl = process.env.RAILS_API_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // rewrites で Rails に転送するリクエストの本文は既定で 10MB までしか届かないため、
    // アップロード上限（500MB：backend の Material::MAX_FILE_SIZE）＋ multipart の余白まで広げる。
    // 本文はいったん Next.js のメモリに載るので、同時に大きなファイルを多数送る運用には向かない
    proxyClientMaxBodySize: '520mb',
  },
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
      // Active Storageの添付ファイル配信をRailsへ転送
      {
        source: '/rails/active_storage/:path*',
        destination: `${railsApiUrl}/rails/active_storage/:path*`,
      },
    ];
  },
};

export default nextConfig;
