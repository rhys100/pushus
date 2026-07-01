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

export async function detectPwaInstalledViaBrowserApi(): Promise<boolean> {
  if (typeof navigator === 'undefined') {
    return false
  }

  const getInstalledRelatedApps = (navigator as NavigatorWithInstalledRelatedApps)
    .getInstalledRelatedApps

  if (!getInstalledRelatedApps) {
    return false
  }

  try {
    const relatedApps = await getInstalledRelatedApps()
    const installed = relatedApps.some((app) => app.platform === 'webapp')

    if (installed) {
      markPwaKnownInstalled()
    }

    return installed
  } catch {
    return false
  }
}
