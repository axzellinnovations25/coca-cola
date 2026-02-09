'use client';

import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  sessionId: string;
  exp?: number;
}

interface SessionInfo {
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
  lastRefresh?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const API_BASE = (() => {
  const override = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '');
  if (override) return override;
  if (process.env.NODE_ENV === 'production') return '/.netlify/functions/api-proxy';
  return 'http://localhost:3001';
})();

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user;

  // Enhanced storage functions with expiration handling
  const setPersistentStorage = (key: string, value: any, expirationDays: number = 5) => {
    if (typeof window === 'undefined') return;
    
    const item = {
      value,
      expiration: Date.now() + (expirationDays * 24 * 60 * 60 * 1000)
    };
    localStorage.setItem(key, JSON.stringify(item));
  };

  const getPersistentStorage = (key: string) => {
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
  };

  const clearPersistentStorage = (key: string) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  };

  // Token refresh function
  const refreshSession = async (): Promise<boolean> => {
    try {
      const sessionInfo = getPersistentStorage('sessionInfo');
      if (!sessionInfo?.refreshToken) {
        return false;
      }

      const response = await fetch(`${API_BASE}/api/session/refresh`, {
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

        // Decode and set user
        const decoded = jwtDecode<User>(data.accessToken);
        setUser(decoded);
        
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    
    return false;
  };

  // Login function
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE}/api/marudham/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store tokens with 5-day expiration
      setPersistentStorage('token', data.accessToken, 5);
      setPersistentStorage('sessionInfo', {
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        sessionId: data.sessionId,
        lastRefresh: Date.now()
      }, 5);

      // Decode and set user
      const decoded = jwtDecode<User>(data.accessToken);
      setUser(decoded);
      
      router.push('/dashboard');
    } catch (error) {
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      // Invalidate session on server if we have session info
      const sessionInfo = getPersistentStorage('sessionInfo');
      if (sessionInfo?.sessionId && user?.id) {
        await fetch(`${API_BASE}/api/session/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId: sessionInfo.sessionId,
            userId: user.id 
          }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      clearPersistentStorage('token');
      clearPersistentStorage('sessionInfo');
      setUser(null);
      router.push('/login');
    }
  };

  // Initialize authentication state on app startup
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      
      try {
        // Check for existing token
        const token = getPersistentStorage('token');
        const sessionInfo = getPersistentStorage('sessionInfo');
        
        if (token && sessionInfo) {
          try {
            // Decode token to check if it's still valid
            const decoded = jwtDecode<User>(token);
            
            // Check if token is expired
            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
              // Token expired, try to refresh
              const refreshed = await refreshSession();
              if (!refreshed) {
                // Refresh failed, clear storage and redirect to login
                clearPersistentStorage('token');
                clearPersistentStorage('sessionInfo');
                router.push('/login');
                return;
              }
            } else {
              // Token is still valid, set user
              setUser(decoded);
            }
          } catch (error) {
            console.error('Token decode error:', error);
            // Try to refresh the session
            const refreshed = await refreshSession();
            if (!refreshed) {
              clearPersistentStorage('token');
              clearPersistentStorage('sessionInfo');
              router.push('/login');
              return;
            }
          }
        } else {
          // No token found, redirect to login
          router.push('/login');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearPersistentStorage('token');
        clearPersistentStorage('sessionInfo');
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [router]);

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!user) return;

    const token = getPersistentStorage('token');
    if (!token) return;

    try {
      const decoded = jwtDecode<User>(token);
      if (!decoded.exp) return;

      // Refresh token 5 minutes before expiration
      const refreshTime = (decoded.exp * 1000) - (5 * 60 * 1000);
      const timeUntilRefresh = refreshTime - Date.now();

      if (timeUntilRefresh > 0) {
        const timeoutId = setTimeout(async () => {
          await refreshSession();
        }, timeUntilRefresh);

        return () => clearTimeout(timeoutId);
      } else {
        // Token is close to expiration, refresh immediately
        refreshSession();
      }
    } catch (error) {
      console.error('Auto-refresh setup error:', error);
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
