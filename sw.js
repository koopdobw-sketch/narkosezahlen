// Offline-Cache: Die App lädt bei bestehender Verbindung immer die neueste Version
// und speichert sie. Ohne Netz wird die gespeicherte Version genutzt.
const CACHE = 'narkose-tool-v3';
const DATEIEN = [
  './', './index.html', './app.js', './parser.js', './katalog.js',
  './katalog-regeln.js', './zuordnung.js', './export.js', './xlsx.js', './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html')))
  );
});
