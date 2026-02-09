// API configuration utility
const API_CONFIG = {
  // Use Netlify function in production, direct backend in development
  baseUrl: (() => {
    const override = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '');
    if (override) return override;
    if (process.env.NODE_ENV === 'production') return '/.netlify/functions/api-proxy';
    return 'http://localhost:3001';
  })(),

  // Client identifier
  client: 'marudham'
};

// Simple in-memory cache for API responses
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

// Clean up expired cache entries
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > value.ttl) {
      cache.delete(key);
    }
  }
  
  // If cache is too large, remove oldest entries
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, Math.floor(MAX_CACHE_SIZE / 2));
    toRemove.forEach(([key]) => cache.delete(key));
  }
}

// Generate cache key
function getCacheKey(path: string, options: RequestInit = {}): string {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : '';
  return `${method}:${path}:${body}`;
}

// Schedule cleanup
let cleanupScheduled = false;
function scheduleCleanup() {
  if (!cleanupScheduled) {
    cleanupScheduled = true;
    setTimeout(() => {
      cleanupCache();
      cleanupScheduled = false;
    }, CACHE_TTL);
  }
}

// Enhanced storage functions with expiration handling
function setPersistentStorage(key: string, value: any, expirationDays: number = 5) {
  if (typeof window === 'undefined') return;
  
  const item = {
    value,
    expiration: Date.now() + (expirationDays * 24 * 60 * 60 * 1000)
  };
  localStorage.setItem(key, JSON.stringify(item));
}

function getPersistentStorage(key: string) {
  if (typeof window === 'undefined') return null;
  
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const parsed = JSON.parse(item);
    
    // Check if expired
    if (Date.now() > parsed.expiration) {
      localStorage.removeItem(key);
      return null;
    }
    
    return parsed.value;
  } catch (error) {
    console.error('Error reading from persistent storage:', error);
    localStorage.removeItem(key);
    return null;
  }
}

function clearPersistentStorage(key: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

async function refreshToken(): Promise<string | null> {
  try {
    const sessionInfo = getPersistentStorage('sessionInfo');
    if (!sessionInfo?.refreshToken) return null;

    const refreshBase = API_CONFIG.baseUrl;
    const response = await fetch(`${refreshBase}/api/session/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: sessionInfo.refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      
      // Store new tokens with 5-day expiration
      setPersistentStorage('token', data.accessToken, 5);
      setPersistentStorage('sessionInfo', {
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        sessionId: data.sessionId,
        lastRefresh: Date.now()
      }, 5);
      
      return data.accessToken;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  return null;
}

// Legacy apiFetch function for backward compatibility
export async function apiFetch(path: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  const isGetRequest = method === 'GET';
  
  // Check cache for GET requests
  if (isGetRequest) {
    const cacheKey = getCacheKey(path, options);
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
  }
  
  try {
    let token = typeof window !== 'undefined' ? getPersistentStorage('token') : null;
    const headers = {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    
    const base = API_CONFIG.baseUrl;
    // Use Netlify function in prod, direct backend in dev
    let res = await fetch(`${base}${path}`, { 
      ...options, 
      headers,
      // Add timeout for better UX
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    // If token expired, try to refresh it
    if (res.status === 401 && token && typeof window !== 'undefined') {
      const newToken = await refreshToken();
      if (newToken) {
        // Retry the request with new token
        headers.Authorization = `Bearer ${newToken}`;
        res = await fetch(`${base}${path}`, { 
          ...options, 
          headers,
          signal: AbortSignal.timeout(10000)
        });
      } else {
        // Refresh failed, redirect to login
        clearPersistentStorage('token');
        clearPersistentStorage('sessionInfo');
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');
      }
    }
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Network error' }));
      
      // Debug: Log the error to see what's happening
      console.log('🔍 API Error:', {
        status: res.status,
        path,
        error: errorData.error,
        url: res.url
      });
      
      // Only logout on specific session-related errors, not all 401s
      if (
        res.status === 401 &&
        errorData.error &&
        (errorData.error.toLowerCase().includes('session is inactive') ||
         errorData.error.toLowerCase().includes('invalid token') ||
         errorData.error.toLowerCase().includes('token expired') ||
         errorData.error.toLowerCase().includes('unauthorized'))
      ) {
        console.log('🚪 Logging out due to session error:', errorData.error);
        clearPersistentStorage('token');
        clearPersistentStorage('sessionInfo');
        window.location.href = '/login';
        throw new Error('Session is inactive or expired. Please login again.');
      }
      
      throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Cache successful GET responses
    if (isGetRequest) {
      const cacheKey = getCacheKey(path, options);
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: CACHE_TTL
      });
      scheduleCleanup();
    }
    
    return data;
  } catch (error) {
    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
      }
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error - please check your connection');
      }
    }
    throw error;
  }
}

// Clear cache for specific path or all cache
export function clearCache(path?: string) {
  if (path) {
    // Clear all cache entries for this path
    for (const key of cache.keys()) {
      if (key.includes(path)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

// Prefetch data for better performance
export async function prefetchData(path: string) {
  try {
    await apiFetch(path);
  } catch (error) {
    // Silently fail for prefetch
    console.warn('Prefetch failed:', error);
  }
}

// Helper function to make API calls with fallback (for password reset)
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_CONFIG.baseUrl}/api/${API_CONFIG.client}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error: any) {
    throw error;
  }
}

// Specific API functions for password reset
export const passwordResetAPI = {
  // Request password reset
  forgotPassword: async (email: string) => {
    return apiCall('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  
  // Validate reset token
  validateToken: async (token: string) => {
    return apiCall(`/validate-reset-token/${token}`, {
      method: 'GET',
    });
  },
  
  // Reset password
  resetPassword: async (token: string, newPassword: string) => {
    return apiCall('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },
}; 