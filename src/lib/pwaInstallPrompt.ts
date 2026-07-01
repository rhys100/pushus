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
  promptDismissed: boolean
  isAndroid: boolean
}

export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent)
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

  if (!input.isAndroid) {
    return false
  }

  if (!input.promptAvailable) {
    return false
  }

  if (input.isInstalled) {
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
