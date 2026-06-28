import { appConfig } from '@/lib/config'

export type PostAuthContext = {
  profileOnboarded: boolean
  pendingGroupId: string | null
  hasActiveGroup: boolean
  appAccessAllowed: boolean
  canCreateGroup: boolean
  pendingInviteCode: string | null
}

const INVITE_CODE_PATTERN = /^[a-z0-9]{6,32}$/

export function normalizeInviteCode(raw: string | null | undefined): string | null {
  if (!raw) return null

  const trimmed = raw.trim()
  const joinPathMatch = trimmed.match(/\/join\/([a-zA-Z0-9]+)/i)
  if (joinPathMatch) {
    const fromUrl = joinPathMatch[1].toLowerCase()
    if (INVITE_CODE_PATTERN.test(fromUrl)) return fromUrl
  }

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!normalized || !INVITE_CODE_PATTERN.test(normalized)) return null
  return normalized
}

function resolveInviteOrigin(fallbackOrigin?: string): string {
  if (appConfig.url) return appConfig.url
  if (fallbackOrigin) return fallbackOrigin
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function buildInviteLink(code: string, origin?: string): string {
  const base = resolveInviteOrigin(origin)
  return `${base}/join/${normalizeInviteCode(code) ?? code.trim().toLowerCase()}`
}

export function resolvePostAuthPath({
  profileOnboarded,
  pendingGroupId,
  hasActiveGroup,
  appAccessAllowed,
  canCreateGroup,
  pendingInviteCode,
}: PostAuthContext): string {
  if (!profileOnboarded) return '/onboarding/profile'
  if (pendingGroupId && !hasActiveGroup) return '/pending'
  if (hasActiveGroup) return '/today'
  if (pendingInviteCode) return `/join/${pendingInviteCode}`
  if (canCreateGroup) return '/group/create'
  if (!appAccessAllowed) return '/private-beta'
  return '/private-beta'
}
