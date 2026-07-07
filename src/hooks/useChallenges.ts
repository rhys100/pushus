import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  challengeDateRange,
  challengeWindow,
  type ChallengeEntryRow,
  type ChallengeFormat,
  type ChallengeParticipantRow,
  type ChallengeTeamMemberRow,
  type ChallengeTeamRow,
} from '@/lib/challenges'
import { gamificationKeys } from '@/hooks/useGamification'
import type { Group } from '@/types/database'
import type { Competition, CompetitionIntensity } from '@/types/gamification'

export const challengeKeys = {
  detail: (competitionId: string) => ['challenge', competitionId] as const,
  participants: (competitionId: string) => ['challenge', competitionId, 'participants'] as const,
  teams: (competitionId: string) => ['challenge', competitionId, 'teams'] as const,
  entries: (competitionId: string) => ['challenge', competitionId, 'entries'] as const,
}

export function useChallenge(competitionId: string | undefined) {
  return useQuery({
    queryKey: challengeKeys.detail(competitionId ?? ''),
    queryFn: async (): Promise<Competition> => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId!)
        .single()

      if (error) throw error
      return data as Competition
    },
    enabled: Boolean(competitionId),
  })
}

export function useChallengeParticipants(competitionId: string | undefined) {
  return useQuery({
    queryKey: challengeKeys.participants(competitionId ?? ''),
    queryFn: async (): Promise<ChallengeParticipantRow[]> => {
      const { data, error } = await supabase
        .from('competition_participants')
        .select('user_id, official_scoring_starts_at, joined_at')
        .eq('competition_id', competitionId!)

      if (error) throw error
      return (data ?? []) as ChallengeParticipantRow[]
    },
    enabled: Boolean(competitionId),
    staleTime: 30_000,
  })
}

export function useChallengeTeams(competitionId: string | undefined) {
  return useQuery({
    queryKey: challengeKeys.teams(competitionId ?? ''),
    queryFn: async (): Promise<{
      teams: ChallengeTeamRow[]
      memberships: ChallengeTeamMemberRow[]
    }> => {
      const { data: teams, error: teamsError } = await supabase
        .from('challenge_teams')
        .select('id, name')
        .eq('competition_id', competitionId!)
        .order('created_at', { ascending: true })

      if (teamsError) throw teamsError

      const teamIds = (teams ?? []).map((team) => team.id)
      if (teamIds.length === 0) {
        return { teams: [], memberships: [] }
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from('challenge_team_members')
        .select('team_id, user_id')
        .in('team_id', teamIds)

      if (membershipsError) throw membershipsError

      return {
        teams: (teams ?? []) as ChallengeTeamRow[],
        memberships: (memberships ?? []) as ChallengeTeamMemberRow[],
      }
    },
    enabled: Boolean(competitionId),
    staleTime: 30_000,
  })
}

/** Live entries covering the challenge window (all group members, for scoring). */
export function useChallengeEntries(
  group: Group | null | undefined,
  competition: Competition | null | undefined,
) {
  const timezone = group?.timezone || 'UTC'

  return useQuery({
    queryKey: challengeKeys.entries(competition?.id ?? ''),
    queryFn: async (): Promise<ChallengeEntryRow[]> => {
      const { startIso, endIso } = challengeDateRange(competition!, timezone)

      const { data, error } = await supabase
        .from('pushup_entries')
        .select('user_id, count, logged_for')
        .eq('group_id', group!.id)
        .gte('logged_for', startIso)
        .lte('logged_for', endIso)
        .is('deleted_at', null)
        .in('review_status', ['none', 'approved'])

      if (error) throw error
      return (data ?? []) as ChallengeEntryRow[]
    },
    enabled: Boolean(group?.id && competition?.id),
    staleTime: 30_000,
  })
}

export type CreateChallengeInput = {
  name: string
  format: ChallengeFormat
  challengeType: 'leaderboard' | 'total_target' | 'team_total'
  intensity: CompetitionIntensity
  targetTotal?: number
  teamNames?: [string, string]
  customStartIso?: string
  customEndIso?: string
}

export function useCreateChallenge(group: Group | null | undefined, userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateChallengeInput): Promise<Competition> => {
      if (!group?.id || !userId) {
        throw new Error('No active group')
      }

      const timezone = group.timezone || 'UTC'
      const window = challengeWindow(
        input.format,
        timezone,
        new Date(),
        input.customStartIso,
        input.customEndIso,
      )

      const { data, error } = await supabase
        .from('competitions')
        .insert({
          group_id: group.id,
          name: input.name.trim(),
          competition_kind: 'custom',
          challenge_type: input.challengeType,
          intensity: input.intensity,
          starts_at: window.startsAt.toISOString(),
          ends_at: window.endsAt.toISOString(),
          target_total: input.challengeType === 'total_target' ? input.targetTotal : null,
          settings: { format: input.format },
          created_by: userId,
        })
        .select('*')
        .single()

      if (error) throw error
      const competition = data as Competition

      if (input.challengeType === 'team_total') {
        const [teamA, teamB] = input.teamNames ?? ['Team A', 'Team B']
        const { error: teamsError } = await supabase.from('challenge_teams').insert([
          { competition_id: competition.id, name: teamA.trim() || 'Team A' },
          { competition_id: competition.id, name: teamB.trim() || 'Team B' },
        ])

        if (teamsError) throw teamsError
      }

      return competition
    },
    onSuccess: () => {
      if (group?.id) {
        void queryClient.invalidateQueries({ queryKey: gamificationKeys.competitions(group.id) })
      }
    },
  })
}

export function useJoinChallenge(competitionId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (teamId?: string) => {
      if (!competitionId || !userId) {
        throw new Error('Not ready to join')
      }

      const { error } = await supabase.from('competition_participants').insert({
        competition_id: competitionId,
        user_id: userId,
      })

      // Already joined is fine — allows picking a team after the fact.
      if (error && error.code !== '23505') throw error

      if (teamId) {
        const { error: teamError } = await supabase.from('challenge_team_members').insert({
          team_id: teamId,
          user_id: userId,
        })

        if (teamError && teamError.code !== '23505') throw teamError
      }
    },
    onSuccess: () => {
      if (competitionId) {
        void queryClient.invalidateQueries({ queryKey: challengeKeys.participants(competitionId) })
        void queryClient.invalidateQueries({ queryKey: challengeKeys.teams(competitionId) })
      }
    },
  })
}
