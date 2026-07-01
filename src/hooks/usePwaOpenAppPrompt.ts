import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  detectPwaInstalledViaBrowserApi,
  syncPwaKnownInstalledFromDisplayMode,
} from '@/lib/pwaInstalled'
import {
  getPwaInstallPlatform,
  isStandaloneDisplayMode,
  type PwaInstallPlatform,
} from '@/lib/pwaInstallPrompt'
import { shouldShowPwaOpenAppPrompt } from '@/lib/pwaOpenAppPrompt'
import {
  setPwaInstallDockVisible,
} from '@/lib/pwaInstallDockVisibility'
import {
  dismissPwaOpenAppPrompt,
  isPwaKnownInstalled,
  isPwaOpenAppPromptDismissed,
} from '@/lib/storage'
import { useAuth } from '@/providers/AuthProvider'

function getPlatform(): PwaInstallPlatform {
  try {
    return getPwaInstallPlatform(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints,
    )
  } catch {
    return 'other'
  }
}

export function usePwaOpenAppPrompt() {
  const { session, profileOnboarded, appAccess, profileReady, appAccessLoading } = useAuth()
  const location = useLocation()
  const userId = session?.user?.id
  const [promptDismissed, setPromptDismissed] = useState(false)
  const [pwaKnownInstalled, setPwaKnownInstalled] = useState(() => {
    syncPwaKnownInstalledFromDisplayMode()
    return isPwaKnownInstalled()
  })
  const platform = useMemo(getPlatform, [])

  useEffect(() => {
    setPromptDismissed(userId ? isPwaOpenAppPromptDismissed(userId) : false)
  }, [userId])

  useEffect(() => {
    const knownInstalled = syncPwaKnownInstalledFromDisplayMode()
    setPwaKnownInstalled(knownInstalled)

    if (knownInstalled || platform !== 'android') {
      return
    }

    let cancelled = false

    void detectPwaInstalledViaBrowserApi().then((installed) => {
      if (!cancelled && installed) {
        setPwaKnownInstalled(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [platform])

  const visible = useMemo(() => {
    if (!userId || !profileReady || appAccessLoading) {
      return false
    }

    return shouldShowPwaOpenAppPrompt({
      pathname: location.pathname,
      isAuthenticated: Boolean(session),
      profileOnboarded,
      appAccessAllowed: appAccess.allowed,
      isStandalone: isStandaloneDisplayMode(),
      pwaKnownInstalled,
      promptDismissed,
      platform,
    })
  }, [
    userId,
    profileReady,
    appAccessLoading,
    location.pathname,
    session,
    profileOnboarded,
    appAccess.allowed,
    pwaKnownInstalled,
    promptDismissed,
    platform,
  ])

  useEffect(() => {
    setPwaInstallDockVisible('open-app', visible)
    return () => setPwaInstallDockVisible('open-app', false)
  }, [visible])

  const dismiss = useCallback(() => {
    if (!userId) {
      return
    }

    dismissPwaOpenAppPrompt(userId)
    setPromptDismissed(true)
  }, [userId])

  return {
    visible,
    platform,
    dismiss,
    pathname: location.pathname,
  }
}
