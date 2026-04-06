import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

import type { NextConfig } from 'next';

const BACKEND_URLS = {
  development: 'http://localhost:3001',
  production: 'http://3.81.158.4:3001',
} as const;

const getBackendUrl = (nodeEnv: string | undefined) =>
  process.env.BACKEND_URL ||
  (nodeEnv === 'production' ? BACKEND_URLS.production : BACKEND_URLS.development);

const createHeaders = (nodeEnv: string | undefined): NonNullable<NextConfig['headers']> => async () => {
  const isDevelopment = nodeEnv === 'development';
  const backendUrl = getBackendUrl(nodeEnv);

  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
        },
        {
          key: 'Content-Security-Policy',
          value: isDevelopment
            ? [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self'",
                `connect-src 'self' ${backendUrl} http://localhost:* http://172.20.10.4:* https:`,
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
              ].join('; ')
            : [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self'",
                `connect-src 'self' ${backendUrl} https:`,
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
              ].join('; '),
        },
        ...(nodeEnv === 'production'
          ? [
              {
                key: 'Strict-Transport-Security',
                value: 'max-age=31536000; includeSubDomains; preload',
              },
            ]
          : []),
      ],
    },
    {
      source: '/api/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, max-age=0',
        },
      ],
    },
    {
      source: '/_next/static/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ];
};

const createRedirects = (nodeEnv: string | undefined): NonNullable<NextConfig['redirects']> => async () => {
  if (nodeEnv !== 'production') {
    return [];
  }

  return [
    {
      source: '/:path*',
      has: [
        {
          type: 'header',
          key: 'x-forwarded-proto',
          value: 'http',
        },
      ],
      destination: 'https://:host/:path*',
      permanent: true,
    },
  ];
};

const createRewrites = (nodeEnv: string | undefined): NonNullable<NextConfig['rewrites']> => async () => {
  const backendUrl = getBackendUrl(nodeEnv);

  return [
    {
      source: '/api/marudham/:path*',
      destination: `${backendUrl}/api/marudham/:path*`,
    },
    {
      source: '/api/session/:path*',
      destination: `${backendUrl}/api/session/:path*`,
    },
  ];
};

export default (phase: string): NextConfig => {
  const nodeEnv = process.env.NODE_ENV;
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  const config: NextConfig = {
    compress: true,
    poweredByHeader: false,
    generateEtags: false,
    output: isDevServer ? undefined : 'export',
    trailingSlash: true,
    env: {
      BACKEND_URL: getBackendUrl(nodeEnv),
    },
    experimental: {
      optimizeCss: true,
      optimizePackageImports: ['react', 'react-dom'],
    },
    turbopack: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    images: {
      formats: ['image/webp', 'image/avif'],
      minimumCacheTTL: 60,
      dangerouslyAllowSVG: true,
      contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
      unoptimized: true,
    },
    webpack: (webpackConfig, { dev, isServer }) => {
      if (!dev && !isServer) {
        webpackConfig.optimization.usedExports = true;
        webpackConfig.optimization.sideEffects = false;
        webpackConfig.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
            },
          },
        };
        webpackConfig.optimization.minimize = true;
      }

      return webpackConfig;
    },
  };

  if (isDevServer) {
    config.headers = createHeaders(nodeEnv);
    config.redirects = createRedirects(nodeEnv);
    config.rewrites = createRewrites(nodeEnv);
  }

  return config;
};
