'use client';

import { useEffect } from 'react';

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (window.location.hostname === 'localhost' && window.location.protocol !== 'https:') {
      // Allow http on localhost only
    }

    const register = async () => {
      try {
        // Ensure old service workers/caches don't serve stale UI
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
        } catch {}

        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // Attempt to update on load
        registration.update().catch(() => {});

        // Listen for new updates and prompt activation
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available; could show a toast if desired
            }
          });
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Service worker registration failed:', error);
      }
    };

    register();
  }, []);

  return null;
}



