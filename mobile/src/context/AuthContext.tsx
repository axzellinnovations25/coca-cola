import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL, clearSession, refreshToken } from '../api/api';

interface User {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  sessionId?: string;
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

type StoredItem<T> = {
  value: T;
  expiration: number;
};

async function setPersistentStorage<T>(key: string, value: T, expirationDays = 5) {
  const item: StoredItem<T> = {
    value,
    expiration: Date.now() + expirationDays * 24 * 60 * 60 * 1000,
  };
  await AsyncStorage.setItem(key, JSON.stringify(item));
}

async function getPersistentStorage<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredItem<T>;
    if (Date.now() > parsed.expiration) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const refreshSession = async () => {
    const newToken = await refreshToken();
    if (!newToken) return false;

    try {
      const decoded = jwtDecode<User>(newToken);
      setUser(decoded);
      return true;
    } catch {
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/marudham/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    await setPersistentStorage('token', data.accessToken, 5);
    await setPersistentStorage<SessionInfo>(
      'sessionInfo',
      {
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        sessionId: data.sessionId,
        lastRefresh: Date.now(),
      },
      5,
    );

    const decoded = jwtDecode<User>(data.accessToken);
    setUser(decoded);
  };

  const logout = async () => {
    try {
      const sessionInfo = await getPersistentStorage<SessionInfo>('sessionInfo');
      if (sessionInfo?.sessionId && user?.id) {
        await fetch(`${API_BASE_URL}/api/session/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionInfo.sessionId,
            userId: user.id,
          }),
        });
      }
    } catch {
      // Ignore logout errors; we'll still clear local state.
    } finally {
      await clearSession();
      setUser(null);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      try {
        const token = await getPersistentStorage<string>('token');
        const sessionInfo = await getPersistentStorage<SessionInfo>('sessionInfo');

        if (token && sessionInfo) {
          try {
            const decoded = jwtDecode<User>(token);
            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
              const refreshed = await refreshSession();
              if (!refreshed) {
                await clearSession();
                setUser(null);
                return;
              }
            } else {
              setUser(decoded);
            }
          } catch {
            const refreshed = await refreshSession();
            if (!refreshed) {
              await clearSession();
              setUser(null);
              return;
            }
          }
        } else {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      login,
      logout,
      refreshSession,
    }),
    [user, isLoading, isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

