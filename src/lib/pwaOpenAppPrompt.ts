import { PWA_INSTALL_PROMPT_EXCLUDED_PATHS } from '@/lib/pwaInstallPrompt'
import type { PwaInstallPlatform } from '@/lib/pwaInstallPrompt'

export type PwaOpenAppPromptVisibilityInput = {
  pathname: string
  isAuthenticated: boolean
  profileOnboarded: boolean
  appAccessAllowed: boolean
  isStandalone: boolean
  pwaKnownInstalled: boolean
  promptDismissed: boolean
  platform: PwaInstallPlatform
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

  if (!input.pwaKnownInstalled) {
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
