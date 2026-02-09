// Environment configuration utility
export const config = {
  // Backend URL configuration
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'http://3.81.158.4:3001'  // Production backend
      : 'http://localhost:3001'), // Development backend
  
  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // App configuration
  appName: 'MotionRep',
  appDomain: process.env.NEXT_PUBLIC_APP_DOMAIN || 'sbdistribution.store',
  
  // API configuration
  apiTimeout: 10000, // 10 seconds
  maxRetries: 3,
  
  // Feature flags
  features: {
    performanceMonitoring: process.env.NODE_ENV === 'development',
    debugLogging: process.env.NODE_ENV === 'development',
  }
};

// Helper function to get backend URL for different contexts
export function getBackendUrl(context?: 'api' | 'websocket' | 'default'): string {
  const baseUrl = config.backendUrl;
  
  switch (context) {
    case 'websocket':
      return baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    case 'api':
    case 'default':
    default:
      return baseUrl;
  }
}

// Helper function to check if we're in a browser environment
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// Helper function to check if we're in a server environment
export function isServer(): boolean {
  return typeof window === 'undefined';
} 