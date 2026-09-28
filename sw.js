/* Finanzplaner – Service Worker
   Liefert die App offline aus dem Speicher und aktualisiert sie still im Hintergrund.
   Bei jeder neuen App-Version VERSION erhöhen (muss APP_VERSION in index.html entsprechen). */
const VERSION = '3.25';
const CACHE = `finanzplaner-${VERSION}`;
const FONTS = 'fonts-cache';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // alte App-Versionen aufräumen, Schriften behalten
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('finanzplaner-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === location.origin && /\/kurse\.json$/.test(url.pathname)) {
    // Kurse (F3): immer zuerst aus dem Netz, offline der zuletzt geladene Stand
    event.respondWith(caches.open(CACHE).then((cache) => fetch(request)
      .then((response) => { if (response && response.ok) cache.put('./kurse.json', response.clone()); return response; })
      .catch(() => cache.match('./kurse.json').then((hit) => hit || Response.error()))));
    return;
  }

  if (url.origin === location.origin) {
    // sofort aus dem Speicher, parallel aus dem Netz nachladen (stale-while-revalidate)
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const cached = (await cache.match(request, { ignoreSearch: true }))
        || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
      const network = fetch(request)
        .then((response) => { if (response && response.ok) cache.put(request, response.clone()); return response; })
        .catch(() => cached);
      return cached || network;
    }));
    return;
  }

  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    // Schriften einmal laden, danach offline aus dem Speicher
    event.respondWith(caches.open(FONTS).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      cache.put(request, response.clone());
      return response;
    }));
  }
});
