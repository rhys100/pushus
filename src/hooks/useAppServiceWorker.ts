import { useEffect } from 'react'
import { registerAppServiceWorker } from '@/lib/notifications/registerPush'

export function useAppServiceWorker() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      return
    }

    void registerAppServiceWorker().catch(() => {
      // Service worker registration is best-effort here. Push setup surfaces errors when needed.
    })
  }, [])
}
