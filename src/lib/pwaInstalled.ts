import { isStandalonePwa } from '@/lib/pwa'
import { isPwaKnownInstalled, markPwaKnownInstalled } from '@/lib/storage'

type InstalledRelatedApp = {
  id?: string
  platform?: string
  url?: string
}

type NavigatorWithInstalledRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<InstalledRelatedApp[]>
}

export function syncPwaKnownInstalledFromDisplayMode(): boolean {
  if (!isStandalonePwa()) {
    return isPwaKnownInstalled()
  }

  markPwaKnownInstalled()
  return true
}

export function hasGetInstalledRelatedAppsSupport(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return typeof (navigator as NavigatorWithInstalledRelatedApps).getInstalledRelatedApps ===
    'function'
}

export async function detectPwaInstalledViaBrowserApi(): Promise<boolean> {
  if (!hasGetInstalledRelatedAppsSupport()) {
    return false
  }

  const getInstalledRelatedApps = (navigator as NavigatorWithInstalledRelatedApps)
    .getInstalledRelatedApps!

  try {
    const relatedApps = await getInstalledRelatedApps()
    const installed = relatedApps.some(
      (app) =>
        app.platform === 'webapp' ||
        app.id === '/' ||
        (typeof app.url === 'string' && app.url.includes('manifest.webmanifest')),
    )

    if (installed) {
      markPwaKnownInstalled()
    }

    return installed
  } catch {
    return false
  }
}
