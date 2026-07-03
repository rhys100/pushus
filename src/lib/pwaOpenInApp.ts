const OPEN_APP_ENTRY_PATH = '/today'

/**
 * Custom scheme the installed PWA registers via manifest `protocol_handlers`.
 *
 * Navigating to `web+pushus://open` from a browser tab (on a user gesture) asks
 * Android to hand the URL to the installed standalone app instead of opening
 * another browser tab. We use this instead of an `intent://` VIEW URL because a
 * plain https VIEW intent has no way to target the WebAPK — Chrome is itself a
 * valid https handler, so it just reloads the page in the tab. A registered
 * custom protocol resolves to the PWA specifically.
 *
 * Caveat: this only works once the installed app has been updated to a build
 * whose manifest declares the handler. Older installs must be reinstalled.
 */
export const PWA_LAUNCH_PROTOCOL = 'web+pushus'

export function buildPwaOpenInAppUrl(pathname: string, origin = 'https://www.pushus.app'): string {
  const safePath = pathname.startsWith('/') ? pathname : OPEN_APP_ENTRY_PATH
  const url = new URL(safePath, origin)
  url.searchParams.set('source', 'open-app')
  return url.toString()
}

/** URL that triggers the installed PWA's protocol handler from a user gesture. */
export function buildPwaProtocolLaunchUrl(): string {
  return `${PWA_LAUNCH_PROTOCOL}://open`
}

export function openInstalledPwa(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.location.href = buildPwaProtocolLaunchUrl()
}

export function canTryOpenInInstalledApp(platform: 'android' | 'ios' | 'other'): boolean {
  return platform === 'android'
}
