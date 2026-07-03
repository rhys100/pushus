const OPEN_APP_ENTRY_PATH = '/today'

/**
 * Custom scheme declared in manifest `protocol_handlers` for desktop Chrome.
 * protocol_handlers is not supported on Chrome Android — use https link hand-off there.
 */
export const PWA_LAUNCH_PROTOCOL = 'web+pushus'

export function buildPwaOpenInAppUrl(pathname: string, origin = 'https://www.pushus.app'): string {
  const safePath = pathname.startsWith('/') ? pathname : OPEN_APP_ENTRY_PATH
  const url = new URL(safePath, origin)
  url.searchParams.set('source', 'open-app')
  return url.toString()
}

/** Desktop fallback — Android should use https link hand-off instead. */
export function buildPwaProtocolLaunchUrl(): string {
  return `${PWA_LAUNCH_PROTOCOL}://open`
}

export function buildAndroidOpenInAppIntentUrl(
  pathname: string,
  origin = 'https://www.pushus.app',
): string {
  const httpsUrl = buildPwaOpenInAppUrl(pathname, origin)
  const target = new URL(httpsUrl)
  const intentTarget = `${target.host}${target.pathname}${target.search}`

  return (
    `intent://${intentTarget}` +
    '#Intent;' +
    'scheme=https;' +
    'action=android.intent.action.VIEW;' +
    'category=android.intent.category.BROWSABLE;' +
    `S.browser_fallback_url=${encodeURIComponent(httpsUrl)};` +
    'end'
  )
}

/**
 * Ask Android to open the installed WebAPK.
 *
 * Chrome Android registers intent filters for in-scope https URLs when a PWA is
 * installed. A real link click (especially in a new tab) hands off to the
 * standalone app. Custom `web+` protocol handlers do not work on Android.
 */
export function openInstalledPwa(
  pathname = typeof window !== 'undefined' ? window.location.pathname : OPEN_APP_ENTRY_PATH,
  origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.pushus.app',
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const httpsUrl = buildPwaOpenInAppUrl(pathname, origin)

  const anchor = document.createElement('a')
  anchor.href = httpsUrl
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

export function canTryOpenInInstalledApp(platform: 'android' | 'ios' | 'other'): boolean {
  return platform === 'android'
}
