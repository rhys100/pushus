import type { NavigateFunction } from 'react-router-dom'
import { parseAppAccess } from '@/lib/appAccess'
import { resolvePostAuthPath } from '@/lib/postAuthRouting'
import { getPendingInviteCode, isProfileCompletedLocally } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import type { GroupMember, Profile } from '@/types/database'

export type PostAuthSnapshot = {
  profile: Profile | null
  memberships: GroupMember[]
  appAccess: ReturnType<typeof parseAppAccess>
  pendingInviteCode: string | null
}

const MEMBER_APP_PATHS = [
  '/today',
  '/leaderboard',
  '/activity',
  '/group',
  '/group/billing',
  '/settings/training',
  '/challenges',
  '/achievements',
] as const

export function isProfileOnboardedFromServer(
  profile: Profile | null,
  userId?: string | null,
): boolean {
  if (profile?.onboarding_completed_at) return true
  if (userId && isProfileCompletedLocally(userId)) return true
  return false
}

export function pickMembershipState(memberships: GroupMember[]): {
  pendingGroupId: string | null
  hasActiveGroup: boolean
} {
  const active = memberships.find((m) => m.status === 'active') ?? null
  const pending = memberships.find((m) => m.status === 'pending') ?? null
  return {
    pendingGroupId: pending?.group_id ?? null,
    hasActiveGroup: Boolean(active),
  }
}

export function isMemberAppPath(path: string): boolean {
  return MEMBER_APP_PATHS.includes(path as (typeof MEMBER_APP_PATHS)[number])
}

export function isPathAllowedForSnapshot(
  path: string,
  snapshot: PostAuthSnapshot,
  options?: { assumeProfileOnboarded?: boolean },
): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false

  const { pendingGroupId, hasActiveGroup } = pickMembershipState(snapshot.memberships)
  const profileOnboarded =
    options?.assumeProfileOnboarded ??
    isProfileOnboardedFromServer(snapshot.profile, snapshot.profile?.id ?? null)

  if (!profileOnboarded) return false
  if (!snapshot.appAccess.allowed) return false
  if (pendingGroupId && !hasActiveGroup) return path === '/pending'
  if (hasActiveGroup) return isMemberAppPath(path)
  if (snapshot.pendingInviteCode) {
    return path === `/join/${snapshot.pendingInviteCode}` || path === '/join'
  }
  if (snapshot.appAccess.can_create_group) {
    return path === '/group/create' || path === '/settings'
  }
  return path === '/private-beta'
}

export async function fetchPostAuthSnapshot(userId: string): Promise<PostAuthSnapshot> {
  const pendingInviteCode = getPendingInviteCode()

  const [profileResult, membershipsResult, accessResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('group_members')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: true }),
    supabase.rpc('get_my_app_access', { p_invite_code: pendingInviteCode }),
  ])

  return {
    profile: (profileResult.data ?? null) as Profile | null,
    memberships: (membershipsResult.data ?? []) as GroupMember[],
    appAccess: parseAppAccess(accessResult.data),
    pendingInviteCode,
  }
}

export function resolvePathFromSnapshot(
  snapshot: PostAuthSnapshot,
  options?: { assumeProfileOnboarded?: boolean },
): string {
  const { pendingGroupId, hasActiveGroup } = pickMembershipState(snapshot.memberships)
  const profileOnboarded =
    options?.assumeProfileOnboarded ??
    isProfileOnboardedFromServer(snapshot.profile, snapshot.profile?.id ?? null)

  return resolvePostAuthPath({
    profileOnboarded,
    pendingGroupId,
    hasActiveGroup,
    appAccessAllowed: snapshot.appAccess.allowed,
    canCreateGroup: snapshot.appAccess.can_create_group,
    pendingInviteCode: snapshot.pendingInviteCode,
  })
}

export function resolveNavigationPath(
  snapshot: PostAuthSnapshot,
  options?: { assumeProfileOnboarded?: boolean; returnTo?: string | null },
): string {
  const defaultPath = resolvePathFromSnapshot(snapshot, options)
  const returnTo = options?.returnTo?.split('?')[0]?.split('#')[0]

  if (returnTo && isPathAllowedForSnapshot(returnTo, snapshot, options)) {
    return returnTo
  }

  return defaultPath
}

export function navigateAfterAuth(
  navigate: NavigateFunction,
  snapshot: PostAuthSnapshot,
  options?: { replace?: boolean; assumeProfileOnboarded?: boolean; returnTo?: string | null },
): void {
  navigate(resolveNavigationPath(snapshot, options), { replace: options?.replace ?? true })
}
