import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { notifySocial } from '@/lib/notifications/notifySocial'
import type {
  MateChallengeItem,
  MateLeaderboardRow,
  MateListItem,
  MateStats,
  MateUser,
  NudgeKind,
} from '@/types/mates'

export const mateKeys = {
  list: () => ['mates'] as const,
  stats: (userId: string) => ['mates', 'stats', userId] as const,
  leaderboard: (days: number) => ['mates', 'leaderboard', days] as const,
  challenges: () => ['mates', 'challenges'] as const,
  code: () => ['mates', 'code'] as const,
}

function parseJsonbArray<T>(data: unknown): T[] {
  const parsed = typeof data === 'string' ? JSON.parse(data) : data
  return Array.isArray(parsed) ? (parsed as T[]) : []
}

export function useMates() {
  return useQuery({
    queryKey: mateKeys.list(),
    queryFn: async (): Promise<MateListItem[]> => {
      const { data, error } = await supabase.rpc('list_mates')
      if (error) throw error
      return parseJsonbArray<MateListItem>(data)
    },
    staleTime: 30_000,
  })
}

export function useMateStats(userId: string | undefined) {
  return useQuery({
    queryKey: mateKeys.stats(userId ?? ''),
    queryFn: async (): Promise<MateStats> => {
      const { data, error } = await supabase.rpc('get_mate_stats', { p_user_id: userId! })
      if (error) throw error
      return (typeof data === 'string' ? JSON.parse(data) : data) as MateStats
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  })
}

export function useMateLeaderboard(days = 7) {
  return useQuery({
    queryKey: mateKeys.leaderboard(days),
    queryFn: async (): Promise<MateLeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('mate_leaderboard', { p_days: days })
      if (error) throw error
      return parseJsonbArray<MateLeaderboardRow>(data)
    },
    staleTime: 30_000,
  })
}

export function useMateChallenges() {
  return useQuery({
    queryKey: mateKeys.challenges(),
    queryFn: async (): Promise<MateChallengeItem[]> => {
      const { data, error } = await supabase.rpc('list_mate_challenges')
      if (error) throw error
      return parseJsonbArray<MateChallengeItem>(data)
    },
    staleTime: 30_000,
  })
}

export type ReceivedNudge = {
  id: string
  sender_id: string
  kind: NudgeKind
  created_at: string
}

/** Nudges received in the last 24h — so a nudge still lands when push missed. */
export function useReceivedNudges(userId: string | undefined) {
  return useQuery({
    queryKey: ['mates', 'nudges', userId ?? ''],
    queryFn: async (): Promise<ReceivedNudge[]> => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('mate_nudges')
        .select('id, sender_id, kind, created_at')
        .eq('recipient_id', userId!)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return (data ?? []) as ReceivedNudge[]
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  })
}

export function useMyMateCode() {
  return useQuery({
    queryKey: mateKeys.code(),
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('get_my_mate_code')
      if (error) throw error
      return data as string
    },
    staleTime: 300_000,
  })
}

function useInvalidateMates() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: mateKeys.list() })
    void queryClient.invalidateQueries({ queryKey: ['mates', 'leaderboard'] })
    void queryClient.invalidateQueries({ queryKey: mateKeys.challenges() })
  }
}

export function useRequestMate() {
  const invalidate = useInvalidateMates()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('request_mate', { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: (_data, userId) => {
      invalidate()
      notifySocial('mate_request', userId)
    },
  })
}

export function useRespondMateRequest() {
  const invalidate = useInvalidateMates()
  return useMutation({
    mutationFn: async (input: {
      connectionId: string
      accept: boolean
      /** The requester's user id — notified when you accept. */
      requesterId?: string
    }) => {
      const { error } = await supabase.rpc('respond_mate_request', {
        p_connection_id: input.connectionId,
        p_accept: input.accept,
      })
      if (error) throw error
    },
    onSuccess: (_data, input) => {
      invalidate()
      if (input.accept && input.requesterId) {
        notifySocial('mate_accepted', input.requesterId)
      }
    },
  })
}

export function useRemoveMate() {
  const invalidate = useInvalidateMates()
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase.rpc('remove_mate', { p_connection_id: connectionId })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useBlockMate() {
  const invalidate = useInvalidateMates()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('block_mate', { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useRotateMateCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('rotate_mate_code')
      if (error) throw error
      return data as string
    },
    onSuccess: (code) => {
      queryClient.setQueryData(mateKeys.code(), code)
    },
  })
}

export function useRedeemMateCode() {
  const invalidate = useInvalidateMates()
  return useMutation({
    mutationFn: async (code: string): Promise<Pick<MateUser, 'id' | 'display_name' | 'avatar_emoji'>> => {
      const { data, error } = await supabase.rpc('redeem_mate_code', { p_code: code })
      if (error) throw error
      return (typeof data === 'string' ? JSON.parse(data) : data) as Pick<
        MateUser,
        'id' | 'display_name' | 'avatar_emoji'
      >
    },
    onSuccess: invalidate,
  })
}

export function useSendNudge() {
  return useMutation({
    mutationFn: async (input: { recipientId: string; kind: NudgeKind }) => {
      const { data, error } = await supabase.functions.invoke('send-nudge', {
        body: { recipient_id: input.recipientId, kind: input.kind },
      })

      if (error) {
        // Surface the server's message (e.g. the once-per-day limit) if present.
        const context = (error as { context?: Response }).context
        if (context) {
          const body = (await context.json().catch(() => null)) as { error?: string } | null
          if (body?.error) throw new Error(body.error)
        }
        throw error
      }

      return data as { recorded: boolean; pushed: number }
    },
  })
}

export function useCreateMateChallenge() {
  const invalidate = useInvalidateMates()
  return useMutation({
    mutationFn: async (input: { opponentId: string; durationDays: 1 | 3 | 7 }) => {
      const { error } = await supabase.rpc('create_mate_challenge', {
        p_opponent_id: input.opponentId,
        p_duration_days: input.durationDays,
      })
      if (error) throw error
    },
    onSuccess: (_data, input) => {
      invalidate()
      notifySocial('challenge_invite', input.opponentId)
    },
  })
}

export function useRespondMateChallenge() {
  const invalidate = useInvalidateMates()
  return useMutation({
    mutationFn: async (input: { challengeId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_mate_challenge', {
        p_challenge_id: input.challengeId,
        p_accept: input.accept,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useCancelMateChallenge() {
  const invalidate = useInvalidateMates()
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.rpc('cancel_mate_challenge', {
        p_challenge_id: challengeId,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
