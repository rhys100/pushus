import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  AvatarChip,
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
  isBeginnerWarningIntensity,
  scoreChallenge,
  scoreTeams,
} from '@/lib/challenges'
import { formatMemberListName } from '@/lib/memberDisplayName'
import { getErrorMessage } from '@/lib/errors'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  useChallenge,
  useChallengeEntries,
  useChallengeParticipants,
  useChallengeTeams,
  useDeleteChallenge,
  useJoinChallenge,
} from '@/hooks/useChallenges'
import { useGroupMembers } from '@/hooks/useGroupMembers'
import { useAuth } from '@/providers/AuthProvider'

function statusVariant(status: 'upcoming' | 'active' | 'ended') {
  if (status === 'active') return 'success' as const
  if (status === 'upcoming') return 'accent' as const
  return 'neutral' as const
}

function intensityLabel(intensity: string): string {
  return intensity.charAt(0).toUpperCase() + intensity.slice(1)
}

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
  const deleteMutation = useDeleteChallenge(activeGroup)
  const [confirmingWarning, setConfirmingWarning] = useState(false)
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

  if (challengeLoading || !challenge) {
    return (
      <AppLayout title="Challenge" subtitle={activeGroup?.name} showNav={false}>
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
      toast({ message: getErrorMessage(error, 'Could not delete challenge.'), variant: 'danger' })
    }
  }

  async function handleJoin(teamId?: string) {
    if (needsWarning && !confirmingWarning && !isParticipant) {
      setConfirmingWarning(true)
      return
    }

    try {
      await joinMutation.mutateAsync(teamId)
      setConfirmingWarning(false)
      toast({ message: teamId ? 'Locked in with your team.' : "You're in. Go bank some reps.", variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not join.'), variant: 'danger' })
    }
  }

  return (
    <AppLayout title={challenge.name} subtitle={activeGroup?.name} showNav={false}>
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
              <p className="text-xs text-text-muted">
                {format(new Date(challenge.starts_at), 'd MMM')} –{' '}
                {format(new Date(challenge.ends_at), 'd MMM yyyy')}
              </p>
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
              {confirmingWarning ? (
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
                {confirmingWarning ? "I know what I'm in for — join" : 'Join challenge'}
              </Button>
            </div>
          ) : null}

          {isParticipant && status !== 'ended' ? (
            <p className="text-xs text-success">You're in this one. Reps bank automatically.</p>
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
                      <Button
                        variant="secondary"
                        fullWidth
                        className="min-h-9 text-sm"
                        loading={joinMutation.isPending}
                        onClick={() => void handleJoin(team.id)}
                      >
                        {confirmingWarning ? 'Confirm join' : 'Join'}
                      </Button>
                    ) : isMyTeam ? (
                      <Badge variant="success">Your team</Badge>
                    ) : null}
                  </Card>
                )
              })}
            </div>
            {confirmingWarning && !myTeamId ? (
              <p className="text-xs text-warning">
                {intensityLabel(challenge.intensity)} challenges push hard. Tap join again to
                confirm.
              </p>
            ) : null}
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
            <ul className="space-y-2">
              {standings.map((standing, index) => {
                const member = nameByUser.get(standing.user_id)
                const isSelf = standing.user_id === user?.id
                const isWinner = status === 'ended' && index === 0 && standing.total > 0

                return (
                  <li key={standing.user_id}>
                    <Card
                      padding="sm"
                      className={`flex items-center gap-3 ${isSelf ? 'border-accent/50' : ''}`}
                    >
                      <span className="w-6 shrink-0 text-center font-mono text-sm text-text-muted">
                        {isWinner ? '🏆' : index + 1}
                      </span>
                      <AvatarChip
                        emoji={member?.emoji ?? '💪'}
                        name={member?.name ?? 'Member'}
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
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs text-text-muted transition-colors hover:text-danger"
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
