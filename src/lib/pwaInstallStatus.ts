import { isStandalonePwa } from '@/lib/pwa'
import {
  getInstalledWebAppRelatedApp,
  hasGetInstalledRelatedAppsSupport,
} from '@/lib/pwaInstalled'
import {
  isInstallPromptAvailable,
  isInstallPromptCheckComplete,
} from '@/lib/pwaInstallPromptAvailability'
import { getPwaInstallPlatform, type PwaInstallPlatform } from '@/lib/pwaInstallPrompt'
import {
  clearPwaKnownInstalled,
  clearPwaStandaloneProof,
  hasPwaStandaloneProof,
  markPwaStandaloneProof,
} from '@/lib/storage'

export type PwaInstallStatus = {
  isStandalone: boolean
  /** Standalone session or confirmed via getInstalledRelatedApps — gates push enable. */
  isInstalledForPush: boolean
  /** Show open-in-app instead of install — includes API, standalone proof, or Android no-install-offer. */
  isOpenAppEligible: boolean
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

function isAndroidLikelyInstalledWhenNoInstallOffer(
  platform: PwaInstallPlatform = readPwaInstallPlatform(),
): boolean {
  return (
    platform === 'android' &&
    isInstallPromptCheckComplete() &&
    !isInstallPromptAvailable()
  )
}

/**
 * Re-check whether PushUS is installed as a PWA.
 *
 * Push enable uses strict detection. Open-in-app uses broader signals so members
 * who installed via home screen are not stuck on the install dock when the API
 * lags or Chrome no longer offers beforeinstallprompt.
 */
export async function refreshPwaInstallStatus(): Promise<PwaInstallStatus> {
  const platform = readPwaInstallPlatform()
  const isStandalone = isStandalonePwa()
  const hadStandaloneProof = hasPwaStandaloneProof()

  if (isStandalone) {
    markPwaStandaloneProof()
    return {
      isStandalone: true,
      isInstalledForPush: true,
      isOpenAppEligible: true,
    }
  }

  if (hasGetInstalledRelatedAppsSupport()) {
    const relatedApp = await getInstalledWebAppRelatedApp()

    if (relatedApp) {
      markPwaStandaloneProof()
      return {
        isStandalone: false,
        isInstalledForPush: true,
        isOpenAppEligible: true,
      }
    }

    if (isInstallPromptAvailable()) {
      clearPwaStandaloneProof()
      return {
        isStandalone: false,
        isInstalledForPush: false,
        isOpenAppEligible: false,
      }
    }

    clearPwaKnownInstalled()

    return {
      isStandalone: false,
      isInstalledForPush: false,
      isOpenAppEligible:
        hadStandaloneProof || isAndroidLikelyInstalledWhenNoInstallOffer(platform),
    }
  }

  return {
    isStandalone: false,
    isInstalledForPush: false,
    isOpenAppEligible: hadStandaloneProof || isAndroidLikelyInstalledWhenNoInstallOffer(platform),
  }
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

  return !installStatus.isInstalledForPush
}

/** @deprecated Use isInstalledForPush on PwaInstallStatus */
export type LegacyPwaInstallStatus = {
  isStandalone: boolean
  isInstalled: boolean
}

export function toLegacyInstallStatus(status: PwaInstallStatus): LegacyPwaInstallStatus {
  return {
    isStandalone: status.isStandalone,
    isInstalled: status.isInstalledForPush,
  }
}
