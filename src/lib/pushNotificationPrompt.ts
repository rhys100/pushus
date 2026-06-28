import type { PushPermissionStatus, PushSupportStatus } from '@/lib/notifications/registerPush'

export const PUSH_PROMPT_EXCLUDED_PATHS = [
  '/login',
  '/auth/callback',
  '/onboarding/profile',
  '/today',
] as const

export type PushPromptVisibilityInput = {
  pathname: string
  isAuthenticated: boolean
  profileOnboarded: boolean
  appAccessAllowed: boolean
  pushSupport: PushSupportStatus
  pushPermission: PushPermissionStatus
  pushEnabled: boolean
  promptDismissed: boolean
}

export function shouldShowPushNotificationPrompt(input: PushPromptVisibilityInput): boolean {
  if (!input.isAuthenticated) {
    return false
  }

  if (!input.profileOnboarded) {
    return false
  }

  if (!input.appAccessAllowed) {
    return false
  }

  if (input.pushSupport !== 'supported') {
    return false
  }

  if (input.pushPermission === 'denied') {
    return false
  }

  if (input.pushEnabled) {
    return false
  }

  if (input.promptDismissed) {
    return false
  }

  if (PUSH_PROMPT_EXCLUDED_PATHS.some((path) => input.pathname.startsWith(path))) {
    return false
  }

  return true
}
