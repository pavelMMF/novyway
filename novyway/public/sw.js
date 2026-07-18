// Новый Путь — offline shell service worker
const CACHE = 'novyway-v10-20260718-sponsored-testnet'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

// network-first для навигации, cache-first для статических ассетов
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.headers.has('range') || url.pathname.startsWith('/media/music/') || url.pathname === '/api/music/playlist') {
    e.respondWith(fetch(e.request))
    return
  }
  if (url.origin === location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))) {
    e.respondWith(fetch(e.request))
    return
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copy))
          return r
        })
        .catch(() => caches.match(e.request).then((r) => r ?? caches.match('./index.html'))),
    )
    return
  }
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached ?? fetch(e.request).then((r) => {
        const copy = r.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return r
      })),
    )
  }
})
