const ACTIVE_GROUP_KEY = 'pushus_active_group_id'
const PENDING_INVITE_CODE_KEY = 'pushus_pending_invite_code'
const PROFILE_COMPLETED_KEY = 'pushus_profile_completed'
const PUSH_PROMPT_DISMISSED_PREFIX = 'pushus-push-prompt-dismissed'

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
