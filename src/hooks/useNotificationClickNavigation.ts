import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** Navigate to /today when user taps a push reminder while the app is already open. */
export function useNotificationClickNavigation() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'pushus:notification-click') {
        return
      }

      // Defence in depth: the service worker already origin-checks this, but
      // the message arrives over postMessage, so re-derive a same-origin path
      // here too. startsWith('/') alone would let '//evil.com' and
      // '/\evil.com' through to an external navigation.
      const raw = typeof event.data.url === 'string' ? event.data.url : '/today'
      try {
        const parsed = new URL(raw, window.location.origin)
        if (parsed.origin === window.location.origin) {
          navigate(`${parsed.pathname}${parsed.search}${parsed.hash}`)
        }
      } catch {
        // Unparseable payload — ignore rather than navigate anywhere.
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [navigate])
}
