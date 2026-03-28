const CACHE_NAME = 'nexus-p2p-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './favicon.png',
  './manifest.json',
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache abierto, guardando activos de Nexus P2P...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Estrategia de Cache primero, luego Red (Stale-While-Revalidate similar)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Limpieza de caches antiguos al activar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
