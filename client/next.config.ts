/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  
  // Static export for Netlify
  output: 'export',
  trailingSlash: true,
  
  // Environment variables
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',
  },
  
  // Experimental features
  experimental: {
    // Bundle optimization
    optimizeCss: true,
    optimizePackageImports: ['react', 'react-dom'],
  },
  
  // Turbopack configuration (stable)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    experimental: {
      optimizeCss: true,
      optimizePackageImports: ['react', 'react-dom'],
    },
  }),
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: true,
  },
  
  // Webpack optimizations
  webpack: (config: any, { dev, isServer }: { dev: boolean; isServer: boolean }) => {
    // Production optimizations only
    if (!dev && !isServer) {
      // Enable tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      
      // Split chunks optimization
      config.optimization.splitChunks = {
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
      
      // Minimize CSS
      config.optimization.minimize = true;
    }
    
    return config;
  },
  
  // Headers for security and performance
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const backendUrl = process.env.BACKEND_URL || 
      (process.env.NODE_ENV === 'production' 
        ? 'http://3.81.158.4:3001'  // Production backend
        : 'http://localhost:3001'); // Development backend
    
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
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
          // Content Security Policy - more permissive in development
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
          // HSTS header (only in production)
          ...(process.env.NODE_ENV === 'production' ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }] : []),
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
  },
  
  // HTTPS redirects (only in production)
  async redirects() {
    if (process.env.NODE_ENV === 'production') {
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
    }
    return [];
  },
  
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 
      (process.env.NODE_ENV === 'production' 
        ? 'http://3.81.158.4:3001'  // Production backend
        : 'http://localhost:3001'); // Development backend
    
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
  },
};

export default nextConfig;
