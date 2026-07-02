const OPEN_APP_ENTRY_PATH = '/today'

export function buildPwaOpenInAppUrl(pathname: string, origin = 'https://www.pushus.app'): string {
  const safePath = pathname.startsWith('/') ? pathname : OPEN_APP_ENTRY_PATH
  const url = new URL(safePath, origin)
  url.searchParams.set('source', 'open-app')
  return url.toString()
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

export function openInstalledPwa(pathname: string, origin = 'https://www.pushus.app'): void {
  if (typeof window === 'undefined') {
    return
  }

  window.location.assign(buildAndroidOpenInAppIntentUrl(pathname, origin))
}

export function canTryOpenInInstalledApp(platform: 'android' | 'ios' | 'other'): boolean {
  return platform === 'android'
}
