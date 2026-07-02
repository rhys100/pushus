export const PWA_INSTALL_PROMPT_EXCLUDED_PATHS = [
  '/login',
  '/auth/callback',
  '/onboarding/profile',
  '/today',
  '/settings/training',
] as const

export type PwaInstallPromptVisibilityInput = {
  pathname: string
  isAuthenticated: boolean
  profileOnboarded: boolean
  appAccessAllowed: boolean
  promptAvailable: boolean
  isInstalled: boolean
  pwaKnownInstalled: boolean
  promptDismissed: boolean
  platform: PwaInstallPlatform
}

export type PwaInstallPlatform = 'android' | 'ios' | 'other'

export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent)
}

export function isIosUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/i.test(userAgent)
}

export function getPwaInstallPlatform(
  userAgent: string,
  navigatorPlatform = '',
  maxTouchPoints = 0,
): PwaInstallPlatform {
  if (isAndroidUserAgent(userAgent)) {
    return 'android'
  }

  if (
    isIosUserAgent(userAgent) ||
    (/Macintosh/i.test(userAgent) && /Mac/i.test(navigatorPlatform) && maxTouchPoints > 1)
  ) {
    return 'ios'
  }

  return 'other'
}

export function isStandaloneDisplayMode(): boolean {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean }

  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    standaloneNavigator.standalone === true
  )
}

export function shouldShowPwaInstallPrompt(
  input: PwaInstallPromptVisibilityInput,
): boolean {
  if (!input.isAuthenticated) {
    return false
  }

  if (!input.profileOnboarded) {
    return false
  }

  if (!input.appAccessAllowed) {
    return false
  }

  if (input.platform === 'other') {
    return false
  }

  if (input.platform === 'android' && !input.promptAvailable) {
    return false
  }

  if (input.isInstalled) {
    return false
  }

  if (input.pwaKnownInstalled) {
    return false
  }

  if (input.promptDismissed) {
    return false
  }

  if (PWA_INSTALL_PROMPT_EXCLUDED_PATHS.some((path) => input.pathname.startsWith(path))) {
    return false
  }

  return true
}
