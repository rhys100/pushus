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

      const url = typeof event.data.url === 'string' ? event.data.url : '/today'
      if (url.startsWith('/')) {
        navigate(url)
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [navigate])
}
