// Only public summit information is saved. Auth, API responses and private photos
// are never intercepted or cached by this worker.
const CACHE = '100cimscat-offline-v1'
const READER = ['/offline.html', '/offline.js', '/icon.svg']

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
