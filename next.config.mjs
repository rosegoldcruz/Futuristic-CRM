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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://auth.privy.io https://*.privy.io https://privy.vulpinehomes.com https://js.hcaptcha.com https://*.hcaptcha.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://auth.privy.io https://*.privy.io https://privy.vulpinehomes.com https://*.hcaptcha.com https://hcaptcha.com https://challenges.cloudflare.com https://explorer-api.walletconnect.com wss://*.privy.io",
              "frame-src 'self' https://auth.privy.io https://*.privy.io https://privy.vulpinehomes.com https://*.hcaptcha.com https://hcaptcha.com https://challenges.cloudflare.com",
              "worker-src 'self' blob:",
              "child-src 'self' blob: https://auth.privy.io https://*.privy.io https://privy.vulpinehomes.com https://*.hcaptcha.com https://hcaptcha.com https://challenges.cloudflare.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
