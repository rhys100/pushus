import type { PwaInstallPlatform } from '@/lib/pwaInstallPrompt'

export const PWA_OPEN_APP_PROMPT_EXCLUDED_PATHS = [
  '/login',
  '/auth/callback',
  '/onboarding/profile',
  '/settings/training',
] as const

export type PwaOpenAppPromptVisibilityInput = {
  pathname: string
  isAuthenticated: boolean
  profileOnboarded: boolean
  appAccessAllowed: boolean
  isStandalone: boolean
  pwaKnownInstalled: boolean
  installPromptDismissed: boolean
  pushEnabled: boolean
  promptDismissed: boolean
  sessionSnoozed: boolean
  platform: PwaInstallPlatform
}

export function isPwaLikelyInstalledForOpenPrompt(input: {
  pwaKnownInstalled: boolean
  platform: PwaInstallPlatform
  installPromptDismissed: boolean
  pushEnabled: boolean
}): boolean {
  if (input.pwaKnownInstalled) {
    return true
  }

  if (input.pushEnabled && input.platform !== 'other') {
    return true
  }

  if (input.platform === 'ios' && input.installPromptDismissed) {
    return true
  }

  return false
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
      pwaKnownInstalled: input.pwaKnownInstalled,
      platform: input.platform,
      installPromptDismissed: input.installPromptDismissed,
      pushEnabled: input.pushEnabled,
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
