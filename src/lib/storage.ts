const ACTIVE_GROUP_KEY = 'pushus_active_group_id'
const PENDING_INVITE_CODE_KEY = 'pushus_pending_invite_code'
const PENDING_MATE_CODE_KEY = 'pushus_pending_mate_code'
// A stashed mate code should only survive the immediate sign-in round trip, not
// linger for a later/different account on the same device to silently redeem.
const PENDING_MATE_CODE_TTL_MS = 60 * 60 * 1000
const SOUND_ENABLED_KEY = 'pushus_sound_enabled'
const PROFILE_COMPLETED_KEY = 'pushus_profile_completed'
const PUSH_PROMPT_DISMISSED_PREFIX = 'pushus-push-prompt-dismissed'
const PWA_INSTALL_PROMPT_DISMISSED_PREFIX = 'pushus-pwa-install-prompt-dismissed'
const PWA_OPEN_APP_PROMPT_DISMISSED_PREFIX = 'pushus-pwa-open-app-never-remind-v2'
const PWA_OPEN_APP_PROMPT_SNOOZED_SESSION_PREFIX = 'pushus-pwa-open-app-prompt-snoozed'
const PWA_KNOWN_INSTALLED_KEY = 'pushus-pwa-known-installed'
const PWA_STANDALONE_PROOF_KEY = 'pushus-pwa-standalone-proof'
const LOG_ACTIVITY_PREFIX = 'pushus-log-activity'
const NEWS_LAST_SEEN_PREFIX = 'pushus-news-last-seen'

export function getPendingInviteCode(): string | null {
  try {
    const value = localStorage.getItem(PENDING_INVITE_CODE_KEY)
    return value?.trim() ? value.trim().toLowerCase() : null
  } catch {
    return null
  }
}

export function setPendingInviteCode(code: string): void {
  try {
    localStorage.setItem(PENDING_INVITE_CODE_KEY, code.trim().toLowerCase())
  } catch {
    // ignore quota / private mode
  }
}

export function clearPendingInviteCode(): void {
  try {
    localStorage.removeItem(PENDING_INVITE_CODE_KEY)
  } catch {
    // ignore
  }
}

// A mate code captured from /mates/add/:code before sign-in, redeemed once the
// visitor is authenticated + onboarded. Mirrors the pending invite code so a
// shared mate link survives the passwordless email sign-in round trip.
export function getPendingMateCode(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_MATE_CODE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as { c?: unknown; t?: unknown }
    const code = typeof parsed.c === 'string' ? parsed.c.trim().toLowerCase() : ''
    if (!code || typeof parsed.t !== 'number' || Date.now() - parsed.t > PENDING_MATE_CODE_TTL_MS) {
      clearPendingMateCode()
      return null
    }
    return code
  } catch {
    return null
  }
}

export function setPendingMateCode(code: string): void {
  try {
    localStorage.setItem(
      PENDING_MATE_CODE_KEY,
      JSON.stringify({ c: code.trim().toLowerCase(), t: Date.now() }),
    )
  } catch {
    // ignore quota / private mode
  }
}

export function clearPendingMateCode(): void {
  try {
    localStorage.removeItem(PENDING_MATE_CODE_KEY)
  } catch {
    // ignore
  }
}

/** Logger sound effects. Defaults on; only an explicit '0' mutes. */
export function getSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== '0'
  } catch {
    return true
  }
}

export function setSoundEnabledStored(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}

export function getStoredActiveGroupId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY)
  } catch {
    return null
  }
}

export function setStoredActiveGroupId(groupId: string): void {
  try {
    localStorage.setItem(ACTIVE_GROUP_KEY, groupId)
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredActiveGroupId(): void {
  try {
    localStorage.removeItem(ACTIVE_GROUP_KEY)
  } catch {
    // ignore
  }
}

export function markProfileCompleted(userId: string): void {
  try {
    sessionStorage.setItem(`${PROFILE_COMPLETED_KEY}:${userId}`, 'true')
  } catch {
    // ignore
  }
}

export function isProfileCompletedLocally(userId: string): boolean {
  try {
    return sessionStorage.getItem(`${PROFILE_COMPLETED_KEY}:${userId}`) === 'true'
  } catch {
    return false
  }
}

export function isPushPromptDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${PUSH_PROMPT_DISMISSED_PREFIX}:${userId}`) === '1'
  } catch {
    return false
  }
}

export function dismissPushPrompt(userId: string): void {
  try {
    localStorage.setItem(`${PUSH_PROMPT_DISMISSED_PREFIX}:${userId}`, '1')
  } catch {
    // ignore
  }
}

export function isPwaInstallPromptDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${PWA_INSTALL_PROMPT_DISMISSED_PREFIX}:${userId}`) === '1'
  } catch {
    return false
  }
}

export function dismissPwaInstallPrompt(userId: string): void {
  try {
    localStorage.setItem(`${PWA_INSTALL_PROMPT_DISMISSED_PREFIX}:${userId}`, '1')
  } catch {
    // ignore
  }
}

export function isPwaKnownInstalled(): boolean {
  try {
    return localStorage.getItem(PWA_KNOWN_INSTALLED_KEY) === '1'
  } catch {
    return false
  }
}

export function markPwaKnownInstalled(): void {
  try {
    localStorage.setItem(PWA_KNOWN_INSTALLED_KEY, '1')
  } catch {
    // ignore
  }
}

/** Set when the member opens PushUS in standalone or we confirm install via the browser API. */
export function markPwaStandaloneProof(): void {
  try {
    localStorage.setItem(PWA_STANDALONE_PROOF_KEY, String(Date.now()))
    markPwaKnownInstalled()
  } catch {
    // ignore
  }
}

export function hasPwaStandaloneProof(): boolean {
  try {
    return localStorage.getItem(PWA_STANDALONE_PROOF_KEY) != null
  } catch {
    return false
  }
}

export function clearPwaKnownInstalled(): void {
  try {
    localStorage.removeItem(PWA_KNOWN_INSTALLED_KEY)
  } catch {
    // ignore
  }
}

export function clearPwaStandaloneProof(): void {
  try {
    localStorage.removeItem(PWA_STANDALONE_PROOF_KEY)
    clearPwaKnownInstalled()
  } catch {
    // ignore
  }
}

export function clearPwaInstallPromptDismiss(userId: string): void {
  try {
    localStorage.removeItem(`${PWA_INSTALL_PROMPT_DISMISSED_PREFIX}:${userId}`)
  } catch {
    // ignore
  }
}

export function isPwaOpenAppPromptDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(`${PWA_OPEN_APP_PROMPT_DISMISSED_PREFIX}:${userId}`) === '1'
  } catch {
    return false
  }
}

export function clearPwaOpenAppPromptDismiss(userId: string): void {
  try {
    localStorage.removeItem(`${PWA_OPEN_APP_PROMPT_DISMISSED_PREFIX}:${userId}`)
  } catch {
    // ignore
  }
}

export function resetPwaOpenAppPromptReminders(userId: string): void {
  clearPwaOpenAppPromptDismiss(userId)
  clearPwaOpenAppPromptSessionSnooze(userId)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pushus:pwa-open-app-recheck'))
  }
}

export function dismissPwaOpenAppPrompt(userId: string): void {
  try {
    localStorage.setItem(`${PWA_OPEN_APP_PROMPT_DISMISSED_PREFIX}:${userId}`, '1')
  } catch {
    // ignore
  }
}

export function isPwaOpenAppPromptSnoozedForSession(userId: string): boolean {
  try {
    return sessionStorage.getItem(`${PWA_OPEN_APP_PROMPT_SNOOZED_SESSION_PREFIX}:${userId}`) === '1'
  } catch {
    return false
  }
}

export function snoozePwaOpenAppPromptForSession(userId: string): void {
  try {
    sessionStorage.setItem(`${PWA_OPEN_APP_PROMPT_SNOOZED_SESSION_PREFIX}:${userId}`, '1')
  } catch {
    // ignore
  }
}

export function clearPwaOpenAppPromptSessionSnooze(userId: string): void {
  try {
    sessionStorage.removeItem(`${PWA_OPEN_APP_PROMPT_SNOOZED_SESSION_PREFIX}:${userId}`)
  } catch {
    // ignore
  }
}

export function acknowledgePwaOpenAppPromptOpen(userId: string): void {
  clearPwaOpenAppPromptDismiss(userId)
  snoozePwaOpenAppPromptForSession(userId)
}

/** Newest "What's new" item id this member has seen (per device). */
export function getLastSeenNewsId(userId: string): string | null {
  try {
    return localStorage.getItem(`${NEWS_LAST_SEEN_PREFIX}:${userId}`)
  } catch {
    return null
  }
}

export function setLastSeenNewsId(userId: string, newsId: string): void {
  try {
    localStorage.setItem(`${NEWS_LAST_SEEN_PREFIX}:${userId}`, newsId)
  } catch {
    // ignore quota / private mode
  }
}

/** Last activity picked on the Log page; null means the group push-ups logger. */
export function getStoredLogActivityId(userId: string): string | null {
  try {
    return localStorage.getItem(`${LOG_ACTIVITY_PREFIX}:${userId}`)
  } catch {
    return null
  }
}

export function setStoredLogActivityId(userId: string, activityId: string | null): void {
  try {
    if (activityId === null) {
      localStorage.removeItem(`${LOG_ACTIVITY_PREFIX}:${userId}`)
    } else {
      localStorage.setItem(`${LOG_ACTIVITY_PREFIX}:${userId}`, activityId)
    }
  } catch {
    // ignore quota / private mode
  }
}
