const OPEN_APP_ENTRY_PATH = '/today'

/**
 * Custom scheme declared in manifest `protocol_handlers` for desktop Chrome.
 * protocol_handlers is not supported on Chrome Android.
 */
export const PWA_LAUNCH_PROTOCOL = 'web+pushus'

export type AndroidOpenInAppIntentOptions = {
  /** When false, Chrome won't silently reload the browser tab on failure. */
  includeBrowserFallback?: boolean
  /** org.chromium.webapk.* when exposed by getInstalledRelatedApps */
  webApkPackage?: string | null
}

export function buildPwaOpenInAppUrl(pathname: string, origin = 'https://www.pushus.app'): string {
  const safePath = pathname.startsWith('/') ? pathname : OPEN_APP_ENTRY_PATH
  const url = new URL(safePath, origin)
  url.searchParams.set('source', 'open-app')
  return url.toString()
}

/** Desktop-only helper — not used for Android hand-off. */
export function buildPwaProtocolLaunchUrl(): string {
  return `${PWA_LAUNCH_PROTOCOL}://open`
}

export function buildAndroidOpenInAppIntentUrl(
  pathname: string,
  origin = 'https://www.pushus.app',
  options: AndroidOpenInAppIntentOptions = {},
): string {
  const httpsUrl = buildPwaOpenInAppUrl(pathname, origin)
  const target = new URL(httpsUrl)
  const intentTarget = `${target.host}${target.pathname}${target.search}`
  const includeBrowserFallback = options.includeBrowserFallback ?? false

  let intent =
    `intent://${intentTarget}` +
    '#Intent;' +
    'scheme=https;' +
    'action=android.intent.action.VIEW;' +
    'category=android.intent.category.BROWSABLE;'

  if (options.webApkPackage) {
    intent += `package=${options.webApkPackage};`
  }

  if (includeBrowserFallback) {
    intent += `S.browser_fallback_url=${encodeURIComponent(httpsUrl)};`
  }

  intent += 'end'
  return intent
}

/**
 * Best-effort Android hand-off from a browser tab.
 *
 * Chrome cannot reliably launch an installed WebAPK while you are already
 * browsing the same site in a tab — https links and fallback intents just
 * reload the page (the flash members report). We only fire an intent without
 * browser fallback, optionally scoped to the WebAPK package when Chrome exposes it.
 */
export function openInstalledPwa(
  pathname = typeof window !== 'undefined' ? window.location.pathname : OPEN_APP_ENTRY_PATH,
  origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.pushus.app',
  webApkPackage?: string | null,
): void {
  if (typeof window === 'undefined') {
    return
  }

  const intentUrl = buildAndroidOpenInAppIntentUrl(pathname, origin, {
    webApkPackage,
    includeBrowserFallback: false,
  })

  window.location.assign(intentUrl)
}

export function canTryOpenInInstalledApp(platform: 'android' | 'ios' | 'other'): boolean {
  return platform === 'android'
}
