/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@wstprtradio/shared', '@wstprtradio/ui'],
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
