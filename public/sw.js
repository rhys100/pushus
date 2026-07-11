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
      // Same-tag notifications replace the one already in the tray; without
      // renotify Android does that silently, so only the first reminder of the
      // day ever made a sound if the user never dismissed it.
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

  // Also clear any sibling reminders left in the tray so a stale one can't
  // linger behind the one just tapped.
  event.waitUntil(
    Promise.all([closeReminderNotifications(), focusOrOpenClient(targetUrl)]),
  )
})
