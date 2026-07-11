import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import {
  dismissPwaInstallPrompt,
  isPwaInstallPromptDismissed,
  isPwaKnownInstalled,
  markPwaStandaloneProof,
} from '@/lib/storage'
import {
  isStandaloneDisplayMode,
  shouldShowPwaInstallPrompt,
} from '@/lib/pwaInstallPrompt'
import { setPwaInstallDockVisible } from '@/lib/pwaInstallDockVisibility'
import {
  INSTALL_PROMPT_CHECK_MS,
  isInstallPromptCheckComplete,
  noteInstallPromptAvailable,
  completeInstallPromptCheckUnavailable,
  subscribeInstallPromptAvailability,
} from '@/lib/pwaInstallPromptAvailability'
import { syncPwaKnownInstalledFromDisplayMode } from '@/lib/pwaInstalled'
import { readPwaInstallPlatform, refreshPwaInstallStatus } from '@/lib/pwaInstallStatus'
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
  const [isOpenAppEligible, setIsOpenAppEligible] = useState(false)
  const [promptDismissed, setPromptDismissed] = useState(false)
  const platform = useMemo(readPwaInstallPlatform, [])
  useSyncExternalStore(
    subscribeInstallPromptAvailability,
    isInstallPromptCheckComplete,
    () => false,
  )
  const installPromptCheckComplete = isInstallPromptCheckComplete()

  useEffect(() => {
    setPromptDismissed(userId ? isPwaInstallPromptDismissed(userId) : false)
  }, [userId])

  useEffect(() => {
    const syncDismissState = () => {
      if (userId) {
        setPromptDismissed(isPwaInstallPromptDismissed(userId))
      }
    }

    window.addEventListener('pushus:pwa-install-recheck', syncDismissState)
    return () => window.removeEventListener('pushus:pwa-install-recheck', syncDismissState)
  }, [userId])

  useEffect(() => {
    void refreshPwaInstallStatus().then((status) => {
      setPwaKnownInstalled(status.isInstalledForPush || status.isOpenAppEligible)
      setIsOpenAppEligible(status.isOpenAppEligible)
    })

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || isStandaloneDisplayMode()) {
        return
      }

      void refreshPwaInstallStatus().then((status) => {
        setPwaKnownInstalled(status.isInstalledForPush || status.isOpenAppEligible)
        setIsOpenAppEligible(status.isOpenAppEligible)
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      noteInstallPromptAvailable()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      markPwaStandaloneProof()
      setPwaKnownInstalled(true)
      setIsOpenAppEligible(true)
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

    const installPromptCheckTimeout = window.setTimeout(() => {
      completeInstallPromptCheckUnavailable()
    }, INSTALL_PROMPT_CHECK_MS)

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    displayModeQuery?.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.clearTimeout(installPromptCheckTimeout)
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
      installPromptCheckComplete,
      isInstalled,
      pwaKnownInstalled,
      isOpenAppEligible,
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
    installPromptCheckComplete,
    isInstalled,
    pwaKnownInstalled,
    isOpenAppEligible,
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
      dismiss()
      return
    }

    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      setDeferredPrompt(null)

      if (choice.outcome === 'accepted') {
        markPwaStandaloneProof()
        setPwaKnownInstalled(true)
        setIsOpenAppEligible(true)
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
    hasNativeInstallPrompt: Boolean(deferredPrompt),
  }
}
