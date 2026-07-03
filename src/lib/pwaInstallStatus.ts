import { isStandalonePwa } from '@/lib/pwa'
import {
  getInstalledWebAppRelatedApp,
  hasGetInstalledRelatedAppsSupport,
} from '@/lib/pwaInstalled'
import { getPwaInstallPlatform, type PwaInstallPlatform } from '@/lib/pwaInstallPrompt'
import { clearPwaKnownInstalled, markPwaKnownInstalled } from '@/lib/storage'

export type PwaInstallStatus = {
  isStandalone: boolean
  /** Standalone session, or Android getInstalledRelatedApps confirmed install. */
  isInstalled: boolean
}

export function readPwaInstallPlatform(): PwaInstallPlatform {
  if (typeof navigator === 'undefined') {
    return 'other'
  }

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

/**
 * Re-check whether PushUS is installed as a PWA.
 *
 * Clears stale localStorage when Android Chrome reports no related webapp after
 * uninstall — fixes "can't reinstall" when the install dock stays hidden.
 */
export async function refreshPwaInstallStatus(): Promise<PwaInstallStatus> {
  const isStandalone = isStandalonePwa()

  if (isStandalone) {
    markPwaKnownInstalled()
    return { isStandalone: true, isInstalled: true }
  }

  if (hasGetInstalledRelatedAppsSupport()) {
    const relatedApp = await getInstalledWebAppRelatedApp()

    if (relatedApp) {
      markPwaKnownInstalled()
      return { isStandalone: false, isInstalled: true }
    }

    clearPwaKnownInstalled()
    return { isStandalone: false, isInstalled: false }
  }

  return { isStandalone: false, isInstalled: false }
}

/** Push reminders require the installed home-screen app on mobile. */
export function needsPwaInstallForPush(
  installStatus: PwaInstallStatus | null,
  platform: PwaInstallPlatform = readPwaInstallPlatform(),
): boolean {
  if (platform === 'other') {
    return false
  }

  if (!installStatus) {
    return true
  }

  return !installStatus.isInstalled
}
