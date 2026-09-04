/* PushUS service worker — web push + app-shell caching. */

// Caches are NOT keyed by build id: `/assets/*` URLs are content-hashed by Vite,
// so a new build simply requests new URLs and misses cleanly. Renaming a cache
// below is enough to evict the old one (see `activate`).
const SHELL_CACHE = 'pushus-shell-v1'
const ASSET_CACHE = 'pushus-assets-v1'
const KNOWN_CACHES = new Set([SHELL_CACHE, ASSET_CACHE])

/** Cap the hashed-asset cache so superseded builds can't grow it forever. */
const ASSET_CACHE_MAX_ENTRIES = 60
/** Fall back to the cached shell rather than making the user watch a dead socket. */
const NAVIGATION_TIMEOUT_MS = 3_000
const SHELL_URL = '/index.html'

// Never cached: the update checker reads these to decide whether a newer build
// is live, so a cached copy would pin the app to the build it first saw.
const NEVER_CACHE = new Set(['/version.json', '/sw.js', '/boot-guard.js'])

self.addEventListener('install', (event) => {
  // Warm the offline shell so the very first offline launch has something to
  // render. Best-effort — a failure here must not block activation.
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !KNOWN_CACHES.has(key)).map((key) => caches.delete(key))),
      )
      .catch(() => undefined)
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'pushus:skip-waiting') {
    self.skipWaiting()
  }
})

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()

  // Cache.keys() is insertion-ordered, so the head is the oldest entry.
  for (let index = 0; index < keys.length - maxEntries; index += 1) {
    await cache.delete(keys[index])
  }
}

/**
 * Cloudflare Pages can SPA-fallback a missing `/assets/*.js` to index.html
 * mid-deploy. Caching that HTML under a JS URL would serve a broken app from
 * cache long after the deploy settled, so only store what we actually asked for.
 */
function isCacheableAssetResponse(request, response) {
  if (!response || !response.ok || response.type === 'opaque') {
    return false
  }

  const contentType = response.headers.get('content-type') ?? ''
  const wantsHtml = request.destination === 'document'

  return wantsHtml || !contentType.includes('text/html')
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  if (isCacheableAssetResponse(request, response)) {
    await cache.put(request, response.clone())
    void trimCache(cacheName, ASSET_CACHE_MAX_ENTRIES)
  }

  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const network = fetch(request)
    .then((response) => {
      if (isCacheableAssetResponse(request, response)) {
        void cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => undefined)

  if (cached) {
    void network
    return cached
  }

  const response = await network
  return response ?? Response.error()
}

/**
 * Navigations stay network-first so a deploy is picked up on the next launch;
 * the cached shell only steps in when the network is gone or hung. React Router
 * renders the requested route from the shell either way.
 */
async function navigationWithShellFallback(request) {
  const cache = await caches.open(SHELL_CACHE)

  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('navigation timeout')), NAVIGATION_TIMEOUT_MS)
      }),
    ])

    if (isCacheableAssetResponse(request, response)) {
      void cache.put(SHELL_URL, response.clone())
    }

    return response
  } catch {
    const cached = (await cache.match(SHELL_URL)) ?? (await cache.match(request))

    if (cached) {
      return cached
    }

    throw new Error('offline and no cached shell')
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only same-origin GETs are ours to cache. Supabase reads/writes, auth token
  // refreshes and edge-function calls are cross-origin and pass straight through.
  if (request.method !== 'GET' || request.cache === 'no-store') {
    return
  }

  let url

  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (url.origin !== self.location.origin || NEVER_CACHE.has(url.pathname)) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationWithShellFallback(request))
    return
  }

  // Content-hashed by Vite — the URL changes whenever the bytes do, so serving
  // straight from cache can never go stale. This is the repeat-launch win.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  // Stable filenames whose bytes can change between deploys (icons, manifest).
  if (
    url.pathname.startsWith('/pwa/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/icons.svg' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE))
  }
})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'PushUS',
    body: 'Tap to log your push-ups today.',
    url: '/today',
    tag: 'pushus-reminder',
  }

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() }
    }
  } catch {
    // Keep defaults when payload is not JSON.
  }

  const tag =
    typeof payload.tag === 'string' && payload.tag.trim() ? payload.tag.trim() : 'pushus-reminder'

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa/icon-192.png',
      badge: '/pwa/notification-badge-96.png',
      tag,
      // Same-tag notifications replace the one already in the tray; without
      // renotify Android does that silently, so only the first reminder of the
      // day ever made a sound if the user never dismissed it. Social/nudge
      // payloads send their own tags so they don't wipe a sitting reminder.
      renotify: true,
      timestamp: Date.now(),
      // Carry the plan day + send time so the app can spot (and clear) a
      // reminder left over from an earlier day instead of showing a stale count.
      data: {
        url: payload.url,
        localDate: payload.localDate ?? null,
        sentAt: payload.sentAt ?? null,
      },
    }),
  )
})

async function focusOrOpenClient(targetUrl) {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

  for (const client of clientList) {
    if (!client.url.startsWith(self.location.origin)) {
      continue
    }

    if ('navigate' in client && typeof client.navigate === 'function') {
      const navigated = await client.navigate(targetUrl)
      if (navigated && 'focus' in navigated) {
        return navigated.focus()
      }
    }

    client.postMessage({ type: 'pushus:notification-click', url: targetUrl })
    if ('focus' in client) {
      return client.focus()
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(targetUrl)
  }

  return undefined
}

async function closeReminderNotifications() {
  try {
    const notes = await self.registration.getNotifications({ tag: 'pushus-reminder' })
    for (const note of notes) {
      note.close()
    }
  } catch {
    // getNotifications can reject on some engines; clearing is best-effort.
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const rawUrl = event.notification.data?.url ?? '/today'
  let targetUrl = '/today'

  // The push payload is not trusted input, so every candidate goes through a
  // full parse and an origin check. A bare startsWith('/') test is not enough:
  // '//evil.com' and '/\evil.com' both begin with a slash yet resolve to a
  // foreign origin, which would hand an attacker-controlled payload an open
  // redirect through client.navigate()/openWindow() and the in-app router.
  try {
    if (typeof rawUrl === 'string') {
      const parsed = new URL(rawUrl, self.location.origin)
      if (parsed.origin === self.location.origin) {
        targetUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`
      }
    }
  } catch {
    targetUrl = '/today'
  }

  // Also clear any sibling reminders left in the tray so a stale one can't
  // linger behind the one just tapped.
  event.waitUntil(
    Promise.all([closeReminderNotifications(), focusOrOpenClient(targetUrl)]),
  )
})
