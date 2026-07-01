export function buildPwaOpenInAppUrl(pathname: string, origin = 'https://www.pushus.app'): string {
  const safePath = pathname.startsWith('/') ? pathname : '/today'
  const url = new URL(safePath, origin)
  url.searchParams.set('source', 'open-app')
  return url.toString()
}

export function canTryOpenInInstalledApp(platform: 'android' | 'ios' | 'other'): boolean {
  return platform === 'android'
}
