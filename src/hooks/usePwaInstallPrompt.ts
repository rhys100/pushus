import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import {
  dismissPwaInstallPrompt,
  isPwaInstallPromptDismissed,
  isPwaKnownInstalled,
  markPwaKnownInstalled,
} from '@/lib/storage'
import {
  getPwaInstallPlatform,
  isStandaloneDisplayMode,
  shouldShowPwaInstallPrompt,
  type PwaInstallPlatform,
} from '@/lib/pwaInstallPrompt'
import {
  getPwaInstallDockVisible,
  setPwaInstallDockVisible,
  subscribePwaInstallDockVisibility,
} from '@/lib/pwaInstallDockVisibility'
import { syncPwaKnownInstalledFromDisplayMode } from '@/lib/pwaInstalled'
import { useAuth } from '@/providers/AuthProvider'

type BeforeInstallPromptUserChoice = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[]
  readonly userChoice: Promise<BeforeInstallPromptUserChoice>
  prompt: () => Promise<void>
}

function getIsInstalled(): boolean {
  try {
    return isStandaloneDisplayMode()
  } catch {
    return false
  }
}

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

export function usePwaInstallDockVisible(): boolean {
  return useSyncExternalStore(
    subscribePwaInstallDockVisibility,
    getPwaInstallDockVisible,
    () => false,
  )
}

export function usePwaInstallPrompt() {
  const { session, profileOnboarded, appAccess, profileReady, appAccessLoading } = useAuth()
  const location = useLocation()
  const userId = session?.user?.id
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [isInstalled, setIsInstalled] = useState(getIsInstalled)
  const [pwaKnownInstalled, setPwaKnownInstalled] = useState(() => {
    syncPwaKnownInstalledFromDisplayMode()
    return isPwaKnownInstalled()
  })
  const [promptDismissed, setPromptDismissed] = useState(false)
  const platform = useMemo(getPlatform, [])

  useEffect(() => {
    setPromptDismissed(userId ? isPwaInstallPromptDismissed(userId) : false)
  }, [userId])

  useEffect(() => {
    setPwaKnownInstalled(syncPwaKnownInstalledFromDisplayMode())
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      markPwaKnownInstalled()
      setPwaKnownInstalled(true)
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    const displayModeQuery = window.matchMedia?.('(display-mode: standalone)')
    const handleDisplayModeChange = () => {
      const standalone = getIsInstalled()
      setIsInstalled(standalone)
      if (standalone) {
        setPwaKnownInstalled(syncPwaKnownInstalledFromDisplayMode())
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    displayModeQuery?.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      displayModeQuery?.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  const visible = useMemo(() => {
    if (!userId || !profileReady || appAccessLoading) {
      return false
    }

    return shouldShowPwaInstallPrompt({
      pathname: location.pathname,
      isAuthenticated: Boolean(session),
      profileOnboarded,
      appAccessAllowed: appAccess.allowed,
      promptAvailable: Boolean(deferredPrompt),
      isInstalled,
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
    deferredPrompt,
    isInstalled,
    pwaKnownInstalled,
    promptDismissed,
    platform,
  ])

  useEffect(() => {
    setPwaInstallDockVisible('install', visible)
    return () => setPwaInstallDockVisible('install', false)
  }, [visible])

  const dismiss = useCallback(() => {
    if (!userId) {
      return
    }

    dismissPwaInstallPrompt(userId)
    setPromptDismissed(true)
    setDeferredPrompt(null)
  }, [userId])

  const install = useCallback(async () => {
    if (!deferredPrompt) {
      if (platform === 'ios') {
        dismiss()
      }
      return
    }

    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      setDeferredPrompt(null)

      if (choice.outcome === 'accepted') {
        markPwaKnownInstalled()
        setPwaKnownInstalled(true)
        setIsInstalled(true)
      } else {
        dismiss()
      }
    } catch {
      setDeferredPrompt(null)
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt, dismiss, platform])

  return {
    visible,
    installing,
    platform,
    install,
    dismiss,
    pathname: location.pathname,
  }
}
