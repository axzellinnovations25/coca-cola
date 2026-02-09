const CACHE_VERSION = 'v1';
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([
      OFFLINE_URL,
      '/manifest.json',
      '/MotionRep.png',
    ])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Bypass non-GET or cross-origin
  if (request.method !== 'GET') return;

  // Never cache API calls or authentication endpoints
  if (new URL(request.url).pathname.startsWith('/api/') || 
      new URL(request.url).pathname.startsWith('/.netlify/functions/api-proxy/api/')) return;

  // Cache-first for Next.js static assets
  if (new URL(request.url).pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      }))
    );
    return;
  }

  // Network-first for navigations with offline fallback
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Default: try cache, then network
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
      return response;
    }).catch(() => cached))
  );
});



