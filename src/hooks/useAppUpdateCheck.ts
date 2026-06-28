import { useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { isNewerBuild, parseAppVersionPayload } from '@/lib/appVersion'
import { APP_BUILD_ID } from '@/lib/buildId'
import { reloadAppForBuild, shouldStopReloadAttempts } from '@/lib/reloadApp'

const VERSION_URL = '/version.json'

async function fetchLiveBuildId(): Promise<string | null> {
  const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  const payload = parseAppVersionPayload(await response.json())
  return payload?.buildId ?? null
}

export function useAppUpdateCheck() {
  const { toast } = useToast()
  const activePromptBuildIdRef = useRef<string | null>(null)

  const checkForUpdate = useCallback(async () => {
    if (import.meta.env.DEV) {
      return
    }

    try {
      const liveBuildId = await fetchLiveBuildId()

      if (!liveBuildId || !isNewerBuild(liveBuildId, APP_BUILD_ID)) {
        activePromptBuildIdRef.current = null
        return
      }

      if (shouldStopReloadAttempts(liveBuildId)) {
        return
      }

      if (activePromptBuildIdRef.current === liveBuildId) {
        return
      }

      activePromptBuildIdRef.current = liveBuildId

      toast({
        message: 'A new version is available.',
        variant: 'default',
        durationMs: 60_000,
        actionLabel: 'Refresh',
        onAction: () => {
          void reloadAppForBuild(liveBuildId)
        },
        onDismiss: () => {
          if (activePromptBuildIdRef.current === liveBuildId) {
            activePromptBuildIdRef.current = null
          }
        },
      })
    } catch {
      // Ignore network failures — update check is best-effort only.
    }
  }, [toast])

  useEffect(() => {
    if (import.meta.env.DEV) {
      return
    }

    void checkForUpdate()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [checkForUpdate])
}
