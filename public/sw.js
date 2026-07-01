/* PushUS service worker — web push only (no web-push npm in browser). */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Keep network behaviour unchanged while satisfying older Chromium PWA checks that expect
// a fetch-capable service worker.
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'PushUS',
    body: 'Tap to log your push-ups today.',
    url: '/today',
  }

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() }
    }
  } catch {
    // Keep defaults when payload is not JSON.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa/icon-192.png',
      badge: '/pwa/notification-badge-96.png',
      tag: 'pushus-reminder',
      data: { url: payload.url },
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const rawUrl = event.notification.data?.url ?? '/today'
  let targetUrl = '/today'

  try {
    if (typeof rawUrl === 'string' && rawUrl.startsWith('/')) {
      targetUrl = rawUrl
    } else if (typeof rawUrl === 'string') {
      const parsed = new URL(rawUrl, self.location.origin)
      if (parsed.origin === self.location.origin) {
        targetUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`
      }
    }
  } catch {
    targetUrl = '/today'
  }

  event.waitUntil(focusOrOpenClient(targetUrl))
})
