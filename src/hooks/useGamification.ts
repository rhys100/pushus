import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Group } from '@/types/database'
import type { Achievement, Competition, UserAchievement } from '@/types/gamification'

export const gamificationKeys = {
  competitions: (groupId: string) => ['competitions', groupId] as const,
  achievements: () => ['achievements', 'catalog'] as const,
  userAchievements: (groupId: string, userId: string) =>
    ['achievements', 'user', groupId, userId] as const,
  xpTotal: (groupId: string, userId: string) => ['xp', groupId, userId] as const,
}

async function fetchCompetitions(groupId: string): Promise<Competition[]> {
  const { data, error } = await supabase
    .from('competitions')
    .select('*')
    .eq('group_id', groupId)
    .order('starts_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as Competition[]
}

async function fetchAchievementCatalog(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as Achievement[]
}

async function fetchUserAchievements(
  groupId: string,
  userId: string,
): Promise<UserAchievement[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('*, achievements(*)')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as UserAchievement[]
}

async function fetchXpTotal(groupId: string, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_user_xp_total', {
    p_group_id: groupId,
    p_user_id: userId,
  })

  if (error) {
    throw error
  }

  return Number(data ?? 0)
}

export function useCompetitions(group: Group | null | undefined) {
  return useQuery({
    queryKey: gamificationKeys.competitions(group?.id ?? ''),
    queryFn: () => fetchCompetitions(group!.id),
    enabled: Boolean(group?.id),
    staleTime: 60_000,
  })
}

export function useAchievementCatalog() {
  return useQuery({
    queryKey: gamificationKeys.achievements(),
    queryFn: fetchAchievementCatalog,
    staleTime: 300_000,
  })
}

export function useUserAchievements(group: Group | null | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: gamificationKeys.userAchievements(group?.id ?? '', userId ?? ''),
    queryFn: () => fetchUserAchievements(group!.id, userId!),
    enabled: Boolean(group?.id && userId),
    staleTime: 60_000,
  })
}

export function useXpTotal(group: Group | null | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: gamificationKeys.xpTotal(group?.id ?? '', userId ?? ''),
    queryFn: () => fetchXpTotal(group!.id, userId!),
    enabled: Boolean(group?.id && userId),
    staleTime: 30_000,
  })
}
