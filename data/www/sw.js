// Service Worker for Luna Sailing Dashboard PWA

const CACHE_NAME = 'luna-sailing-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/main.js',
  '/js/ble.js',
  '/js/dashboard.js',
  '/js/pwa-install.js',
  '/js/sailing-map.js',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-512x512.png'
];

// Install event - pre-cache all essential assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
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

// Fetch event - serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
  // Skip BLE connections (though they don't use HTTP fetch)
  if (event.request.url.includes('/ws')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }

        // Clone the request because it's a one-time use stream
        const fetchRequest = event.request.clone();

        // Make network request
        return fetch(fetchRequest)
          .then(response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response because it's a one-time use stream
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // If fetch fails, show offline page for HTML requests
            if (event.request.headers.get('Accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Handle BLE reconnection when coming back online
self.addEventListener('message', event => {
  if (event.data === 'ONLINE') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage('RECONNECT_BLE'));
    });
  }
});
