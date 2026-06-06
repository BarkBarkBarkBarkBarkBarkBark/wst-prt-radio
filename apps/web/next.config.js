/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@wstprtradio/shared', '@wstprtradio/ui'],
  // The workspace uses a custom root ESLint config (@typescript-eslint) rather
  // than eslint-config-next, so the Next.js lint rules (e.g. @next/next/*) are
  // not loaded during `next build`. Linting is run separately via `pnpm lint`;
  // don't let it block production builds.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'radio.wstprtradio.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
