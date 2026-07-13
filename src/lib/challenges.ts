import { addDays, format, startOfDay } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { getZonedTimeParts } from '@/lib/notificationEligibility'
import type { Competition, CompetitionIntensity } from '@/types/gamification'

/**
 * Admin-created challenge formats (docs/product-decisions.md → Challenge
 * decisions). Streak and improvement types are deliberately not offered in
 * the first challenge slice.
 */
export type ChallengeFormat =
  | 'one_day'
  | 'weekend'
  | 'seven_day'
  | 'fourteen_day'
  | 'thirty_day'
  | 'custom'

export const CHALLENGE_FORMAT_OPTIONS: {
  value: ChallengeFormat
  label: string
  description: string
}[] = [
  { value: 'one_day', label: 'One day', description: 'Today only — quick hit' },
  { value: 'weekend', label: 'Weekend', description: 'Saturday and Sunday' },
  { value: 'seven_day', label: '7 days', description: 'One week from today' },
  { value: 'fourteen_day', label: '14 days', description: 'Two weeks from today' },
  { value: 'thirty_day', label: '30 days', description: 'The big one' },
  { value: 'custom', label: 'Custom dates', description: 'Pick start and end days' },
]

export const CHALLENGE_TYPE_OPTIONS: {
  value: 'leaderboard' | 'total_target' | 'team_total'
  label: string
  description: string
}[] = [
  { value: 'leaderboard', label: 'Leaderboard', description: 'Most reps wins' },
  { value: 'total_target', label: 'Group target', description: 'Hit a combined total together' },
  { value: 'team_total', label: 'Team vs team', description: 'Two one-off teams, biggest total wins' },
]

export const INTENSITY_OPTIONS: {
  value: CompetitionIntensity
  label: string
}[] = [
  { value: 'fun', label: 'Fun' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
  { value: 'stupid', label: 'Stupid' },
]

/** Hard and Stupid challenges warn beginners before they join. */
export function isBeginnerWarningIntensity(intensity: CompetitionIntensity): boolean {
  return intensity === 'hard' || intensity === 'stupid'
}

export type ChallengeWindow = {
  startsAt: Date
  endsAt: Date
}

/**
 * Resolve a format to a [start, end) window in the group timezone.
 * Custom formats take inclusive local ISO dates.
 */
export function challengeWindow(
  format: ChallengeFormat,
  timezone: string,
  now: Date = new Date(),
  customStartIso?: string,
  customEndIso?: string,
): ChallengeWindow {
  const zonedNow = toZonedTime(now, timezone)
  const todayStart = startOfDay(zonedNow)

  if (format === 'custom') {
    if (!customStartIso || !customEndIso) {
      throw new Error('Custom challenges need start and end dates')
    }

    const start = fromZonedTime(`${customStartIso}T00:00:00`, timezone)
    const endExclusive = fromZonedTime(`${customEndIso}T00:00:00`, timezone)
    return { startsAt: start, endsAt: addDays(endExclusive, 1) }
  }

  if (format === 'weekend') {
    const dow = zonedNow.getDay()
    // Sat/Sun → this weekend's Saturday; otherwise the upcoming Saturday.
    const daysToSaturday = dow === 0 ? -1 : (6 - dow) % 7
    const saturday = addDays(todayStart, daysToSaturday)
    return {
      startsAt: fromZonedTime(saturday, timezone),
      endsAt: fromZonedTime(addDays(saturday, 2), timezone),
    }
  }

  const spanDays =
    format === 'one_day' ? 1 : format === 'seven_day' ? 7 : format === 'fourteen_day' ? 14 : 30

  return {
    startsAt: fromZonedTime(todayStart, timezone),
    endsAt: fromZonedTime(addDays(todayStart, spanDays), timezone),
  }
}

export type ChallengeStatus = 'upcoming' | 'active' | 'ended'

export function challengeStatus(
  competition: Pick<Competition, 'starts_at' | 'ends_at'>,
  now: Date = new Date(),
): ChallengeStatus {
  if (now < new Date(competition.starts_at)) return 'upcoming'
  if (now >= new Date(competition.ends_at)) return 'ended'
  return 'active'
}

/** Badge tone for a challenge's lifecycle status — shared by the list + detail pages. */
export function statusVariant(status: ChallengeStatus): 'success' | 'accent' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'upcoming') return 'accent'
  return 'neutral'
}

/** Inclusive local-date range covered by a challenge window. */
export function challengeDateRange(
  competition: Pick<Competition, 'starts_at' | 'ends_at'>,
  timezone: string,
): { startIso: string; endIso: string } {
  const startIso = getZonedTimeParts(timezone, new Date(competition.starts_at)).dateKey
  const endIso = getZonedTimeParts(
    timezone,
    new Date(new Date(competition.ends_at).getTime() - 1),
  ).dateKey

  return { startIso, endIso }
}

/**
 * Human label for a challenge's inclusive date span, e.g. "13 Jul – 14 Jul 2026".
 * Uses the group timezone and the inclusive last day (`ends_at` is stored as an
 * exclusive boundary), so the card matches the scored window instead of showing
 * an off-by-one span.
 */
export function formatChallengeRange(
  competition: Pick<Competition, 'starts_at' | 'ends_at'>,
  timezone: string,
): string {
  const { startIso, endIso } = challengeDateRange(competition, timezone)
  // The ISO strings are already group-local calendar dates; parse them as local
  // midnight so formatting only reads the y/m/d parts (no further tz shift).
  const start = new Date(`${startIso}T00:00:00`)
  const end = new Date(`${endIso}T00:00:00`)
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`
}

export type ChallengeEntryRow = {
  user_id: string
  count: number
  logged_for: string
}

export type ChallengeParticipantRow = {
  user_id: string
  official_scoring_starts_at: string
  joined_at: string
}

export type ChallengeStanding = {
  user_id: string
  total: number
  /** First local date that counts for this participant. */
  countedFromIso: string
  /** Joined after the challenge started — reps only count from their join day. */
  joinedLate: boolean
}

/**
 * Score participants over live entries. Late joiners count from the day they
 * joined the challenge (no backfilling wins — locked late-joiner rule).
 */
export function scoreChallenge(params: {
  entries: ChallengeEntryRow[]
  participants: ChallengeParticipantRow[]
  startIso: string
  endIso: string
  timezone: string
}): ChallengeStanding[] {
  const { entries, participants, startIso, endIso, timezone } = params

  // Bucket entries by user once (O(entries)) so each participant only sums its
  // own rows — avoids re-scanning every entry per participant (was O(P×E)).
  const entriesByUser = new Map<string, ChallengeEntryRow[]>()
  for (const entry of entries) {
    const list = entriesByUser.get(entry.user_id)
    if (list) list.push(entry)
    else entriesByUser.set(entry.user_id, [entry])
  }

  const standings = participants.map((participant) => {
    const joinIso = getZonedTimeParts(
      timezone,
      new Date(participant.official_scoring_starts_at),
    ).dateKey
    const countedFromIso = joinIso > startIso ? joinIso : startIso

    const total = (entriesByUser.get(participant.user_id) ?? []).reduce((sum, entry) => {
      if (entry.logged_for < countedFromIso || entry.logged_for > endIso) return sum
      return sum + entry.count
    }, 0)

    return {
      user_id: participant.user_id,
      total,
      countedFromIso,
      joinedLate: countedFromIso > startIso,
    }
  })

  return standings.sort((a, b) => b.total - a.total)
}

export type ChallengeTeamRow = {
  id: string
  name: string
}

export type ChallengeTeamMemberRow = {
  team_id: string
  user_id: string
}

export type TeamStanding = {
  team_id: string
  name: string
  total: number
  memberCount: number
}

export function scoreTeams(
  standings: ChallengeStanding[],
  teams: ChallengeTeamRow[],
  memberships: ChallengeTeamMemberRow[],
): TeamStanding[] {
  const totalsByUser = new Map(standings.map((standing) => [standing.user_id, standing.total]))

  const teamStandings = teams.map((team) => {
    const members = memberships.filter((membership) => membership.team_id === team.id)
    const total = members.reduce(
      (sum, membership) => sum + (totalsByUser.get(membership.user_id) ?? 0),
      0,
    )

    return { team_id: team.id, name: team.name, total, memberCount: members.length }
  })

  return teamStandings.sort((a, b) => b.total - a.total)
}
