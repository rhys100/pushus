/** Default in-scope entry when pathname is missing or invalid. */
export const PWA_OPEN_ENTRY_PATH = '/today'

/**
 * Custom scheme declared in manifest `protocol_handlers` for desktop Chrome.
 * Android hand-off uses window.open to an in-scope https URL instead.
 */
export const PWA_LAUNCH_PROTOCOL = 'web+pushus'

export function resolvePwaOpenPath(pathname?: string): string {
  if (pathname?.startsWith('/')) {
    return pathname
  }

  return PWA_OPEN_ENTRY_PATH
}

export function buildPwaOpenInAppUrl(pathname: string, origin = 'https://www.pushus.app'): string {
  const safePath = resolvePwaOpenPath(pathname)
  const url = new URL(safePath, origin)
  url.searchParams.set('source', 'open-app')
  return url.href
}

/** Desktop-only helper — not used for Android WebAPK hand-off. */
export function buildPwaProtocolLaunchUrl(): string {
  return `${PWA_LAUNCH_PROTOCOL}://open`
}

/**
 * Open the installed PWA on Android Chrome.
 *
 * There is no launchPwa() API. The WebAPK intercepts in-scope https URLs opened
 * in a new browsing context — never use location.assign or SPA navigation here.
 */
export function openInstalledPwa(
  pathname = typeof window !== 'undefined' ? window.location.pathname : PWA_OPEN_ENTRY_PATH,
  origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.pushus.app',
): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const url = buildPwaOpenInAppUrl(pathname, origin)
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  return opened !== null
}

export function canTryOpenInInstalledApp(platform: 'android' | 'ios' | 'other'): boolean {
  return platform === 'android'
}
