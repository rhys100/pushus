import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  AvatarChip,
  BackLink,
  Badge,
  Button,
  Card,
  EmptyState,
  GoalProgressBar,
  Skeleton,
  useToast,
} from '@/components/ui'
import {
  challengeDateRange,
  challengeStatus,
  formatChallengeRange,
  isBeginnerWarningIntensity,
  scoreChallenge,
  scoreTeams,
  statusVariant,
} from '@/lib/challenges'
import { cn } from '@/lib/cn'
import { formatMemberListName } from '@/lib/memberDisplayName'
import { getErrorMessage } from '@/lib/errors'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useFlipList } from '@/hooks/useFlipList'
import {
  useChallenge,
  useChallengeEntries,
  useChallengeParticipants,
  useChallengeTeams,
  useDeleteChallenge,
  useJoinChallenge,
  useLeaveChallenge,
} from '@/hooks/useChallenges'
import { useGroupMembers } from '@/hooks/useGroupMembers'
import { useAuth } from '@/providers/AuthProvider'

function intensityLabel(intensity: string): string {
  return intensity.charAt(0).toUpperCase() + intensity.slice(1)
}

/** Arming key for the solo (non-team) join button's confirm step. */
const SOLO_JOIN_KEY = '__solo__'

export function ChallengeDetailPage() {
  const { competitionId } = useParams<{ competitionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const { activeGroup, role } = useActiveGroup()
  const timezone = activeGroup?.timezone || 'UTC'
  const isAdmin = role === 'owner' || role === 'admin'

  const { data: challenge, isLoading: challengeLoading } = useChallenge(competitionId)
  const { data: participants = [], isLoading: participantsLoading } =
    useChallengeParticipants(competitionId)
  const { data: teamData } = useChallengeTeams(competitionId)
  const { data: entries = [], isLoading: entriesLoading } = useChallengeEntries(
    activeGroup,
    challenge ?? null,
  )
  const { data: members = [] } = useGroupMembers(activeGroup?.id)
  const joinMutation = useJoinChallenge(competitionId, user?.id)
  const leaveMutation = useLeaveChallenge(competitionId, user?.id)
  const deleteMutation = useDeleteChallenge(activeGroup)
  // Confirm-to-join arming is scoped to the specific target (a team id, or
  // SOLO_JOIN_KEY) so a warning-intensity team challenge can't arm every team's
  // button at once — or let a mis-tap join a different team without its warning.
  const [confirmingJoinKey, setConfirmingJoinKey] = useState<string | null>(null)
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const nameByUser = useMemo(() => {
    const map = new Map<string, { name: string; emoji: string }>()
    for (const member of members) {
      if (member.profiles) {
        map.set(member.user_id, {
          name: formatMemberListName(member.profiles, member.viewer_alias),
          emoji: member.profiles.avatar_emoji ?? '💪',
        })
      }
    }
    return map
  }, [members])

  const standings = useMemo(() => {
    if (!challenge) return []
    const { startIso, endIso } = challengeDateRange(challenge, timezone)
    return scoreChallenge({ entries, participants, startIso, endIso, timezone })
  }, [challenge, entries, participants, timezone])

  const teamStandings = useMemo(() => {
    if (!teamData || teamData.teams.length === 0) return []
    return scoreTeams(standings, teamData.teams, teamData.memberships)
  }, [standings, teamData])

  // Competitors glide to their new rank as scores move (range switches,
  // fresh banks) instead of teleporting.
  const standingsListRef = useFlipList<HTMLUListElement>(standings)

  if (challengeLoading || !challenge) {
    return (
      <AppLayout
        title="Challenge"
        subtitle={activeGroup?.name}
        showNav={false}
        headerLeading={<BackLink to="/challenges" label="Challenges" />}
      >
        {challengeLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <EmptyState title="Challenge not found" description="It may have been deleted." />
        )}
      </AppLayout>
    )
  }

  const status = challengeStatus(challenge)
  const isParticipant = participants.some((participant) => participant.user_id === user?.id)
  const needsWarning = isBeginnerWarningIntensity(challenge.intensity)
  const isTeamChallenge = challenge.challenge_type === 'team_total'
  const myTeamId = teamData?.memberships.find((m) => m.user_id === user?.id)?.team_id ?? null
  const groupTotal = standings.reduce((sum, standing) => sum + standing.total, 0)
  const loadingStandings = participantsLoading || entriesLoading

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    try {
      await deleteMutation.mutateAsync(challenge!.id)
      toast({ message: 'Challenge deleted.', variant: 'success' })
      navigate('/challenges')
    } catch (error) {
      // Disarm on failure so a stray later tap can't delete without re-confirming.
      setConfirmingDelete(false)
      toast({ message: getErrorMessage(error, 'Could not delete challenge.'), variant: 'danger' })
    }
  }

  async function handleLeave() {
    if (!confirmingLeave) {
      setConfirmingLeave(true)
      return
    }

    try {
      await leaveMutation.mutateAsync(myTeamId ?? undefined)
      setConfirmingLeave(false)
      toast({ message: 'You left the challenge.', variant: 'success' })
    } catch (error) {
      // Disarm on failure so a stray later tap can't leave without re-confirming.
      setConfirmingLeave(false)
      toast({ message: getErrorMessage(error, 'Could not leave the challenge.'), variant: 'danger' })
    }
  }

  async function handleJoin(teamId?: string) {
    const joinKey = teamId ?? SOLO_JOIN_KEY
    if (needsWarning && confirmingJoinKey !== joinKey && !isParticipant) {
      setConfirmingJoinKey(joinKey)
      return
    }

    try {
      await joinMutation.mutateAsync(teamId)
      setConfirmingJoinKey(null)
      toast({ message: teamId ? 'Locked in with your team.' : "You're in. Go bank some reps.", variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not join.'), variant: 'danger' })
    }
  }

  return (
    <AppLayout
      title={challenge.name}
      subtitle={activeGroup?.name}
      showNav={false}
      headerLeading={<BackLink to="/challenges" label="Challenges" />}
    >
      <div className="space-y-4 pb-8">
        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(status)}>{status}</Badge>
              <Badge variant={needsWarning ? 'warning' : 'neutral'}>
                {intensityLabel(challenge.intensity)}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">{formatChallengeRange(challenge, timezone)}</p>
              {status === 'active' ? (
                <p className="text-xs font-medium text-accent">
                  ends {formatDistanceToNowStrict(new Date(challenge.ends_at), { addSuffix: true })}
                </p>
              ) : status === 'upcoming' ? (
                <p className="text-xs font-medium text-text-muted">
                  starts {formatDistanceToNowStrict(new Date(challenge.starts_at), { addSuffix: true })}
                </p>
              ) : null}
            </div>
          </div>

          {challenge.target_total ? (
            <div className="space-y-1">
              <p className="text-sm text-text-primary">
                Group target:{' '}
                <span className="font-mono font-semibold">
                  {groupTotal.toLocaleString()} / {challenge.target_total.toLocaleString()}
                </span>
              </p>
              <GoalProgressBar
                current={groupTotal}
                target={challenge.target_total}
                ariaLabel="Group challenge progress"
              />
            </div>
          ) : null}

          {status !== 'ended' && !isParticipant && !isTeamChallenge ? (
            <div className="space-y-2">
              {confirmingJoinKey === SOLO_JOIN_KEY ? (
                <p className="text-xs text-warning">
                  {intensityLabel(challenge.intensity)} challenges push hard. Build up with the
                  training plan if you are new — you can still log at your own pace.
                </p>
              ) : null}
              <Button
                fullWidth
                loading={joinMutation.isPending}
                onClick={() => void handleJoin()}
              >
                {confirmingJoinKey === SOLO_JOIN_KEY ? "I know what I'm in for — join" : 'Join challenge'}
              </Button>
              {confirmingJoinKey === SOLO_JOIN_KEY ? (
                <button
                  type="button"
                  className="mx-auto block min-h-9 rounded-[var(--radius-sm)] px-1 text-xs text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  onClick={() => setConfirmingJoinKey(null)}
                >
                  Not now
                </button>
              ) : null}
            </div>
          ) : null}

          {isParticipant && status !== 'ended' ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-success">You're in this one. Reps bank automatically.</p>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                {confirmingLeave ? (
                  <button
                    type="button"
                    className="min-h-9 rounded-[var(--radius-sm)] px-1 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    onClick={() => setConfirmingLeave(false)}
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-pressed={confirmingLeave}
                  className={cn(
                    'min-h-9 rounded-[var(--radius-sm)] px-1 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50',
                    confirmingLeave
                      ? 'font-semibold text-danger'
                      : 'text-text-muted hover:text-danger',
                  )}
                  disabled={leaveMutation.isPending}
                  onClick={() => void handleLeave()}
                >
                  {confirmingLeave ? 'Tap again to leave' : 'Leave'}
                </button>
              </div>
            </div>
          ) : null}
        </Card>

        {isTeamChallenge ? (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Teams</h2>
            <div className="grid grid-cols-2 gap-3">
              {(teamData?.teams ?? []).map((team) => {
                const standing = teamStandings.find((item) => item.team_id === team.id)
                const isMyTeam = myTeamId === team.id
                const leading =
                  teamStandings.length > 1 && teamStandings[0].team_id === team.id &&
                  teamStandings[0].total > teamStandings[1].total

                return (
                  <Card key={team.id} padding="md" className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-text-primary">{team.name}</p>
                      {leading ? <span aria-label="Leading">👑</span> : null}
                    </div>
                    <p className="font-mono text-2xl font-bold text-text-primary">
                      {(standing?.total ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-text-muted">
                      {standing?.memberCount ?? 0} member{(standing?.memberCount ?? 0) === 1 ? '' : 's'}
                    </p>
                    {status !== 'ended' && !myTeamId ? (
                      <>
                        {confirmingJoinKey === team.id ? (
                          <p className="text-xs text-warning">
                            {intensityLabel(challenge.intensity)} challenges push hard. Tap Confirm
                            join to lock in with {team.name}.
                          </p>
                        ) : null}
                        <Button
                          variant="secondary"
                          fullWidth
                          className="min-h-9 text-sm"
                          loading={joinMutation.isPending}
                          onClick={() => void handleJoin(team.id)}
                        >
                          {confirmingJoinKey === team.id ? 'Confirm join' : 'Join'}
                        </Button>
                      </>
                    ) : isMyTeam ? (
                      <Badge variant="success">Your team</Badge>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {status === 'ended' ? 'Final standings' : 'Standings'}
          </h2>

          {loadingStandings ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : standings.length === 0 ? (
            <EmptyState
              title="No one has joined yet"
              description="Be the first in and set the pace."
            />
          ) : (
            <ul ref={standingsListRef} className="motion-stagger space-y-2">
              {standings.map((standing, index) => {
                const member = nameByUser.get(standing.user_id)
                const isSelf = standing.user_id === user?.id
                const isWinner = status === 'ended' && index === 0 && standing.total > 0

                return (
                  <li key={standing.user_id} data-flip-key={standing.user_id}>
                    <Card
                      padding="sm"
                      className={`flex items-center gap-3 ${isSelf ? 'border-accent/50' : ''}`}
                    >
                      <span
                        className={cn(
                          'w-6 shrink-0 text-center font-mono text-sm text-text-muted',
                          isWinner && 'motion-pop text-base',
                        )}
                      >
                        {isWinner ? '🏆' : index + 1}
                      </span>
                      <AvatarChip
                        emoji={member?.emoji ?? '💪'}
                        name={member?.name ?? 'Member'}
                        subtitle={isSelf ? 'You' : undefined}
                        active={isSelf}
                        className="flex-1 border-0 bg-transparent p-0"
                      />
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-text-primary">
                          {standing.total.toLocaleString()}
                        </p>
                        {standing.joinedLate ? (
                          <p className="text-[0.65rem] text-text-muted">
                            since {format(new Date(`${standing.countedFromIso}T12:00:00`), 'd MMM')}
                          </p>
                        ) : null}
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {isAdmin ? (
          <div className="flex items-center justify-end gap-4 text-xs">
            {confirmingDelete ? (
              <button
                type="button"
                className="min-h-9 rounded-[var(--radius-sm)] px-1 text-text-muted transition-colors hover:text-text-primary"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              aria-pressed={confirmingDelete}
              className={cn(
                'min-h-9 rounded-[var(--radius-sm)] px-1 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50',
                confirmingDelete
                  ? 'font-semibold text-danger'
                  : 'text-text-muted hover:text-danger',
              )}
              disabled={deleteMutation.isPending}
              onClick={() => void handleDelete()}
            >
              {confirmingDelete ? 'Tap again to delete this challenge' : 'Delete challenge'}
            </button>
          </div>
        ) : null}
      </div>
    </AppLayout>
  )
}
