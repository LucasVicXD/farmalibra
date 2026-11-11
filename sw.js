const APP_CACHE = 'farmalibras-v6';
const VLIBRAS_CACHE = 'farmalibras-vlibras-cache-v1';

const APP_ASSETS = [
  './',
  './index.html',
  './player.html',
  './player.html?v=6',
  './unity-loader.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      Promise.allSettled(
        APP_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' }).then((res) => {
            if (res && res.ok) return cache.put(url, res);
          })
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== APP_CACHE && k !== VLIBRAS_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Cacheia permanentemente a engine do VLibras e os sinais 3D do dicionário (Cache-First!)
  // Assim, depois de baixar uma única vez, fica salvo no dispositivo.
  if (
    url.hostname === 'vlibras.gov.br' ||
    url.hostname === 'dicionario2.vlibras.gov.br'
  ) {
    event.respondWith(
      caches.open(VLIBRAS_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((netRes) => {
            if (netRes && netRes.status === 200) {
              cache.put(event.request, netRes.clone()).catch(() => {});
            }
            return netRes;
          });
        })
      )
    );
    return;
  }

  // 2. Arquivos locais do aplicativo (Network-First com fallback para Cache)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (networkRes && networkRes.ok) {
          const copy = networkRes.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return networkRes;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true }).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
          return Response.error();
        })
      )
  );
});
