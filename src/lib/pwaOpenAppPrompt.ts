import type { PwaInstallPlatform } from '@/lib/pwaInstallPrompt'

export const PWA_OPEN_APP_PROMPT_EXCLUDED_PATHS = [
  '/login',
  '/auth/callback',
  '/onboarding/profile',
  '/settings/training',
] as const

/**
 * Member tab routes that render inside TabLayout and therefore show the fixed
 * bottom navigation bar. On these routes the open-app dock must sit ABOVE the
 * nav, or its action buttons render behind the nav and become untappable.
 * Exact-match only: sub-routes like /group/billing have no bottom nav.
 */
export const PWA_OPEN_APP_PROMPT_BOTTOM_NAV_PATHS = [
  '/today',
  '/leaderboard',
  '/activity',
  '/group',
  '/settings',
] as const

/**
 * True when the current route shows the bottom nav, so the open-app dock must
 * be offset above it. See tests/unit/pwaOpenAppPrompt.test.ts.
 */
export function pwaOpenAppPromptSitsAboveBottomNav(pathname: string): boolean {
  return (PWA_OPEN_APP_PROMPT_BOTTOM_NAV_PATHS as readonly string[]).includes(pathname)
}

export type PwaOpenAppPromptVisibilityInput = {
  pathname: string
  isAuthenticated: boolean
  profileOnboarded: boolean
  appAccessAllowed: boolean
  isStandalone: boolean
  pwaKnownInstalled: boolean
  isOpenAppEligible: boolean
  installPromptDismissed: boolean
  pushEnabled: boolean
  androidInstallPromptUnavailable: boolean
  promptDismissed: boolean
  sessionSnoozed: boolean
  platform: PwaInstallPlatform
}

export function isPwaLikelyInstalledForOpenPrompt(input: {
  isOpenAppEligible: boolean
}): boolean {
  return input.isOpenAppEligible
}

export function shouldShowPwaOpenAppPrompt(input: PwaOpenAppPromptVisibilityInput): boolean {
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

  if (input.isStandalone) {
    return false
  }

  if (
    !isPwaLikelyInstalledForOpenPrompt({
      isOpenAppEligible: input.isOpenAppEligible,
    })
  ) {
    return false
  }

  if (input.promptDismissed) {
    return false
  }

  if (input.sessionSnoozed) {
    return false
  }

  if (PWA_OPEN_APP_PROMPT_EXCLUDED_PATHS.some((path) => input.pathname.startsWith(path))) {
    return false
  }

  return true
}
