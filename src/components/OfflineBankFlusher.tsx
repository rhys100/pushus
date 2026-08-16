import { useEffect } from 'react'
import { useFlushOfflineBanks } from '@/hooks/useOfflineBankQueue'

/**
 * Drains the offline bank queue whenever a chance appears.
 *
 * Background Sync is deliberately not used. The service worker would need
 * credentials to call `bank_pushups`, but supabase-js keeps the session in
 * localStorage, which a worker cannot read — the alternatives are copying a
 * bearer token into worker-readable storage (a token at rest, for a
 * privacy-first app) or a token that has expired by the time sync fires. iOS
 * has no Background Sync at all regardless.
 *
 * So the triggers are the ones that actually cover the real cases: the network
 * returning, the app being brought back to the foreground, and app start.
 */
export function OfflineBankFlusher() {
  const flush = useFlushOfflineBanks()

  useEffect(() => {
    void flush()

    const onOnline = () => void flush()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void flush()
      }
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flush])

  return null
}
