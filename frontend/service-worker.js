// service-worker.js
// Guarda em cache os arquivos do "esqueleto" do app, para abrir mais rápido.
// Importante: o monitoramento em si NÃO depende deste arquivo — ele roda no
// servidor. Este service worker só ajuda o app a abrir mais rápido/offline.

const CACHE_NAME = 'radar-ingressos-v1';
const APP_SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca guarda em cache chamadas de API: elas precisam sempre ser atuais.
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
