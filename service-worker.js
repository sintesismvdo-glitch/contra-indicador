const CACHE_NAME = 'senal-contra-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap'
];

// Install event — pre-cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.log('Pre-cache error (non-critical):', err);
        // Don't fail install if some assets fail; app still works with dynamic caching
        return cache.add('./index.html');
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event — network-first for API calls, cache-first for assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Binance API calls: network-first (always try fresh data)
  if (url.hostname === 'api.binance.com') {
    event.respondWith(
      fetch(request).then(response => {
        // Cache successful API responses
        if (response.ok) {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clonedResponse);
          });
        }
        return response;
      }).catch(() => {
        // Fallback to cache on network error
        return caches.match(request).then(cached => {
          if (cached) {
            console.log('Using cached Binance data (offline)');
            return cached;
          }
          // If no cache, return offline placeholder
          return new Response(
            JSON.stringify([]),
            { status: 503, statusText: 'Offline - No cached data' }
          );
        });
      })
    );
  } else {
    // Static assets (HTML, CSS, JS, fonts): cache-first
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clonedResponse);
          });
          return response;
        }).catch(() => {
          // If both cache and network fail, return a minimal fallback
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});

// Update check (optional: check for new version every 1h)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
