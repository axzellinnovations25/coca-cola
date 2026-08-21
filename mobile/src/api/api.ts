import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

type ExpoExtra = {
  apiBaseUrlProd?: string;
  apiBaseUrlDev?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
const envOverride = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

export const API_BASE_URL =
  envOverride ||
  (__DEV__
    ? extra.apiBaseUrlDev ?? 'http://localhost:3000'
    : extra.apiBaseUrlProd ?? 'https://api.sbdistribution.store');

type StoredItem<T> = {
  value: T;
  expiration: number;
};

type ApiCacheEntry<T = any> = {
  data: T;
  updatedAt: number;
};

const apiCache = new Map<string, ApiCacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const cacheVersions = new Map<string, number>();

const getCacheKey = (path: string) => path;

export function getCachedApiData<T>(path: string): T | undefined {
  return apiCache.get(getCacheKey(path))?.data as T | undefined;
}

export function getApiCacheAge(path: string): number | null {
  const entry = apiCache.get(getCacheKey(path));
  return entry ? Date.now() - entry.updatedAt : null;
}

export function invalidateApiCache(paths?: string[]) {
  if (!paths?.length) {
    apiCache.clear();
    for (const key of inFlightRequests.keys()) {
      cacheVersions.set(key, (cacheVersions.get(key) || 0) + 1);
    }
    inFlightRequests.clear();
    return;
  }

  const knownKeys = new Set([...apiCache.keys(), ...inFlightRequests.keys(), ...paths]);
  for (const key of knownKeys) {
    if (paths.some((path) => key === path || key.startsWith(`${path}/`) || key.startsWith(`${path}?`))) {
      apiCache.delete(key);
      inFlightRequests.delete(key);
      cacheVersions.set(key, (cacheVersions.get(key) || 0) + 1);
    }
  }
}

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

async function clearPersistentStorage(key: string) {
  await AsyncStorage.removeItem(key);
}

export async function refreshToken(): Promise<string | null> {
  try {
    const sessionInfo = await getPersistentStorage<{
      refreshToken: string;
      expiresIn: number;
      sessionId: string;
    }>('sessionInfo');

    if (!sessionInfo?.refreshToken) return null;

    const response = await fetch(`${API_BASE_URL}/api/session/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: sessionInfo.refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    await setPersistentStorage('token', data.accessToken, 5);
    await setPersistentStorage(
      'sessionInfo',
      {
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        sessionId: data.sessionId,
        lastRefresh: Date.now(),
      },
      5,
    );

    return data.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  let token = await getPersistentStorage<string>('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const runFetch = async () => {
    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      method,
      headers,
      signal: controller.signal,
    });
  };

  try {
    let response = await runFetch();

    if (response.status === 401 && token) {
      const newToken = await refreshToken();
      if (newToken) {
        token = newToken;
        headers.Authorization = `Bearer ${newToken}`;
        response = await runFetch();
      } else {
        await clearPersistentStorage('token');
        await clearPersistentStorage('sessionInfo');
        await AsyncStorage.setItem('forceLogout', 'true');
        throw new Error('Session expired. Please login again.');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
      }
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error - please check your connection');
      }
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiFetchCached<T = any>(
  path: string,
  { maxAgeMs = 0, force = false }: { maxAgeMs?: number; force?: boolean } = {},
): Promise<T> {
  const key = getCacheKey(path);
  const cached = apiCache.get(key);
  if (!force && cached && Date.now() - cached.updatedAt <= maxAgeMs) {
    return cached.data as T;
  }

  const existingRequest = inFlightRequests.get(key);
  if (existingRequest) return existingRequest as Promise<T>;

  const requestVersion = cacheVersions.get(key) || 0;
  const request = apiFetch(path)
    .then((data) => {
      if ((cacheVersions.get(key) || 0) === requestVersion) {
        apiCache.set(key, { data, updatedAt: Date.now() });
      }
      return data as T;
    })
    .finally(() => {
      if (inFlightRequests.get(key) === request) {
        inFlightRequests.delete(key);
      }
    });

  inFlightRequests.set(key, request);
  return request;
}

export async function clearSession() {
  invalidateApiCache();
  await clearPersistentStorage('token');
  await clearPersistentStorage('sessionInfo');
}

export async function getStoredToken() {
  return getPersistentStorage<string>('token');
}
