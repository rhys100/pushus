import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import {
  dismissPwaInstallPrompt,
  isPwaInstallPromptDismissed,
} from '@/lib/storage'
import {
  isAndroidUserAgent,
  isStandaloneDisplayMode,
  shouldShowPwaInstallPrompt,
} from '@/lib/pwaInstallPrompt'
import {
  getPwaInstallDockVisible,
  setPwaInstallDockVisible,
  subscribePwaInstallDockVisibility,
} from '@/lib/pwaInstallDockVisibility'
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

function getIsAndroid(): boolean {
  try {
    return isAndroidUserAgent(navigator.userAgent)
  } catch {
    return false
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
  const [promptDismissed, setPromptDismissed] = useState(false)
  const isAndroid = useMemo(getIsAndroid, [])

  useEffect(() => {
    setPromptDismissed(userId ? isPwaInstallPromptDismissed(userId) : false)
  }, [userId])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    const displayModeQuery = window.matchMedia?.('(display-mode: standalone)')
    const handleDisplayModeChange = () => setIsInstalled(getIsInstalled())

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
      promptDismissed,
      isAndroid,
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
    promptDismissed,
    isAndroid,
  ])

  useEffect(() => {
    setPwaInstallDockVisible(visible)
    return () => setPwaInstallDockVisible(false)
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
      return
    }

    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      setDeferredPrompt(null)

      if (choice.outcome === 'accepted') {
        setIsInstalled(true)
      } else {
        dismiss()
      }
    } catch {
      setDeferredPrompt(null)
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt, dismiss])

  return {
    visible,
    installing,
    install,
    dismiss,
    pathname: location.pathname,
  }
}
