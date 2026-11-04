// The cache contains only public assets. Opt-in pending notes live separately
// in account-bound IndexedDB, never in the service worker cache.
const CACHE = '100cimscat-offline-v5'
const READER = ['/offline.html', '/offline.js', '/offline-journal.js', '/journal-store.js', '/summits-catalog.json', '/icon.svg']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(READER)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('100cimscat-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (READER.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)))
  } else if (event.request.mode === 'navigate' && (url.pathname === '/' || url.pathname.startsWith('/cims/'))) {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match('/offline.html'))))
  }
})
