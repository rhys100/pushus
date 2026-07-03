import { isStandalonePwa } from '@/lib/pwa'
import { isPwaKnownInstalled, markPwaKnownInstalled } from '@/lib/storage'

export type InstalledRelatedApp = {
  id?: string
  platform?: string
  url?: string
  version?: string
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

function isInstalledWebApp(app: InstalledRelatedApp): boolean {
  if (app.platform === 'webapp') {
    return true
  }

  if (typeof app.id === 'string' && app.id.startsWith('org.chromium.webapk')) {
    return true
  }

  return (
    app.id === '/' ||
    (typeof app.url === 'string' &&
      (app.url.includes('manifest.json') || app.url.includes('manifest.webmanifest')))
  )
}

export async function getInstalledWebAppRelatedApp(): Promise<InstalledRelatedApp | null> {
  if (!hasGetInstalledRelatedAppsSupport()) {
    return null
  }

  const getInstalledRelatedApps = (navigator as NavigatorWithInstalledRelatedApps)
    .getInstalledRelatedApps!

  try {
    const relatedApps = await getInstalledRelatedApps()
    return relatedApps.find(isInstalledWebApp) ?? null
  } catch {
    return null
  }
}

/** WebAPK package ids look like org.chromium.webapk.* when Chrome exposes them. */
export function readWebApkPackageId(relatedApp: InstalledRelatedApp | null | undefined): string | null {
  if (!relatedApp?.id?.startsWith('org.chromium.webapk')) {
    return null
  }

  return relatedApp.id
}

export async function detectPwaInstalledViaBrowserApi(): Promise<boolean> {
  const relatedApp = await getInstalledWebAppRelatedApp()

  if (!relatedApp) {
    return false
  }

  markPwaKnownInstalled()
  return true
}
