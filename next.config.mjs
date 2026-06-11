/** @type {import("next").NextConfig} */
const nextConfig = {
  // App directory is now stable in Next.js 14, no experimental flag needed
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://auth.privy.io https://*.privy.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://auth.privy.io https://*.privy.io wss://*.privy.io",
              "frame-src 'self' https://auth.privy.io https://*.privy.io",
              "worker-src 'self' blob:",
              "child-src 'self' blob: https://auth.privy.io https://*.privy.io",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
