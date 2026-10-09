/* Local-first app-shell cache. User records, backups and model/API responses are never cached. */
const CACHE_NAME = 'my-adaptive-routine-shell-v1.0.5';
const CORE_ASSETS = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-512-maskable.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch('/', { cache: 'reload' });
    if (!response.ok) throw new Error(`App shell returned HTTP ${response.status}`);
    await cache.put('/', response.clone());
    const html = await response.text();
    const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/giu)]
      .map((match) => new URL(match[1], self.location.origin))
      .filter((url) => url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest'))
      .map((url) => url.href);
    await cache.addAll([...new Set([...CORE_ASSETS, ...assetPaths])]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('my-adaptive-routine-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
        }
        return response;
      }).catch(async () => (await caches.match(request)) || (await caches.match('/')) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith('/src/') || url.pathname.includes('/@vite/')) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })));
});
