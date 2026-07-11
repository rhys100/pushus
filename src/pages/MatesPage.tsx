import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  AvatarChip,
  BackLink,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { appConfig } from '@/lib/config'
import { getErrorMessage } from '@/lib/errors'
import { successHaptic, tapHaptic } from '@/lib/haptics'
import { formatProfileName } from '@/lib/memberDisplayName'
import { useCountUp } from '@/hooks/useCountUp'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useGroupMembers } from '@/hooks/useGroupMembers'
import {
  useBlockMate,
  useCancelMateChallenge,
  useCreateMateChallenge,
  useMateChallenges,
  useMateLeaderboard,
  useMates,
  useMateStats,
  useMyMateCode,
  useReceivedNudges,
  useRemoveMate,
  useRequestMate,
  useRespondMateChallenge,
  useRespondMateRequest,
  useRotateMateCode,
  useSendNudge,
} from '@/hooks/useMates'
import { useAuth } from '@/providers/AuthProvider'
import type { MateChallengeItem, MateListItem, NudgeKind } from '@/types/mates'

const NUDGES: { kind: NudgeKind; emoji: string; label: string }[] = [
  { kind: 'push', emoji: '💪', label: 'Push them' },
  { kind: 'cheer', emoji: '👏', label: 'Cheer' },
  { kind: 'stir', emoji: '😤', label: 'Stir up' },
]

const NUDGE_FEED_COPY: Record<NudgeKind, (name: string) => string> = {
  push: (name) => `💪 ${name} is pushing you — bank some reps`,
  cheer: (name) => `👏 ${name} cheered you on`,
  stir: (name) => `😤 ${name} reckons you've gone quiet`,
}

function StatCell({ label, mine, theirs }: { label: string; mine: number; theirs: number }) {
  const lead = mine > theirs ? 'text-success' : mine < theirs ? 'text-text-muted' : 'text-text-primary'
  const mineDisplay = useCountUp(mine)
  const theirsDisplay = useCountUp(theirs)

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-bg px-2 py-2 text-center">
      <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">{label}</p>
      <p className={cn('font-mono text-sm font-bold', lead)}>{mineDisplay.toLocaleString()}</p>
      <p className="font-mono text-xs text-text-muted">vs {theirsDisplay.toLocaleString()}</p>
    </div>
  )
}

function MateDetail({ mate, onClose }: { mate: MateListItem; onClose: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: myStats } = useMateStats(user?.id)
  const { data: theirStats, isLoading: statsLoading } = useMateStats(mate.user.id)
  const sendNudge = useSendNudge()
  const createChallenge = useCreateMateChallenge()
  const removeMate = useRemoveMate()
  const blockMate = useBlockMate()
  const [duration, setDuration] = useState<1 | 3 | 7>(3)
  // Track which nudge is in flight so only the tapped button spins, not all three.
  const [nudgingKind, setNudgingKind] = useState<NudgeKind | null>(null)
  // Pop only rewards a tap — the default pill mounts still.
  const [durationInteracted, setDurationInteracted] = useState(false)
  // Remove and Block both arm-to-confirm and are mutually exclusive; a stale
  // armed button auto-disarms after 4s so it can't fire on a later stray tap.
  const [pendingDestructive, setPendingDestructive] = useState<'remove' | 'block' | null>(null)

  useEffect(() => {
    if (!pendingDestructive) {
      return
    }
    const timer = window.setTimeout(() => setPendingDestructive(null), 4000)
    return () => window.clearTimeout(timer)
  }, [pendingDestructive])

  async function handleNudge(kind: NudgeKind) {
    setNudgingKind(kind)
    try {
      const result = await sendNudge.mutateAsync({ recipientId: mate.user.id, kind })
      successHaptic()
      toast({
        message:
          result.pushed > 0
            ? `Nudge sent — their phone just went off.`
            : 'Nudge recorded. They will see it in the app.',
        variant: 'success',
      })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not nudge.'), variant: 'danger' })
    } finally {
      setNudgingKind(null)
    }
  }

  async function handleChallenge() {
    try {
      await createChallenge.mutateAsync({ opponentId: mate.user.id, durationDays: duration })
      successHaptic()
      toast({ message: 'Challenge sent. Game on when they accept.', variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not create the challenge.'), variant: 'danger' })
    }
  }

  async function handleRemove() {
    if (pendingDestructive !== 'remove') {
      setPendingDestructive('remove')
      return
    }

    setPendingDestructive(null)
    try {
      await removeMate.mutateAsync(mate.connection_id)
      toast({ message: 'Mate removed.', variant: 'success' })
      onClose()
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not remove mate.'), variant: 'danger' })
    }
  }

  async function handleBlock() {
    if (pendingDestructive !== 'block') {
      setPendingDestructive('block')
      return
    }

    setPendingDestructive(null)
    try {
      await blockMate.mutateAsync(mate.user.id)
      toast({ message: 'Blocked. They cannot reconnect.', variant: 'success' })
      onClose()
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not block.'), variant: 'danger' })
    }
  }

  return (
    <div className="motion-rise space-y-3 border-t border-border pt-3">
      {statsLoading || !theirStats || !myStats ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="space-y-1.5">
          <p className="text-[0.65rem] uppercase tracking-wide text-text-muted">
            You vs {formatProfileName(mate.user)} — your number on top
          </p>
          <div className="grid grid-cols-4 gap-2">
            <StatCell label="Today" mine={myStats.today_total} theirs={theirStats.today_total} />
            <StatCell label="7 days" mine={myStats.seven_day_total} theirs={theirStats.seven_day_total} />
            <StatCell label="30 days" mine={myStats.thirty_day_total} theirs={theirStats.thirty_day_total} />
            <StatCell label="Best day" mine={myStats.best_day_30} theirs={theirStats.best_day_30} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {NUDGES.map((nudge) => (
          <Button
            key={nudge.kind}
            variant="secondary"
            className="min-h-10 whitespace-nowrap px-2 text-sm"
            loading={nudgingKind === nudge.kind}
            disabled={sendNudge.isPending && nudgingKind !== nudge.kind}
            onClick={() => void handleNudge(nudge.kind)}
          >
            {nudge.emoji} {nudge.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 3, 7].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                if (duration !== days) {
                  tapHaptic()
                  setDurationInteracted(true)
                }
                setDuration(days as 1 | 3 | 7)
              }}
              className={cn(
                'min-h-9 flex-1 rounded-[var(--radius-md)] border px-2 text-sm font-medium',
                'transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] active:scale-95',
                duration === days
                  ? cn('border-accent bg-accent-muted text-text-primary', durationInteracted && 'motion-pop')
                  : 'border-border bg-bg text-text-muted',
              )}
            >
              {days}d
            </button>
          ))}
        </div>
        <Button
          className="min-h-9 shrink-0 px-3 text-sm"
          loading={createChallenge.isPending}
          onClick={() => void handleChallenge()}
        >
          ⚔️ Challenge
        </Button>
      </div>

      <div className="flex items-center justify-end gap-4 text-xs">
        <button
          type="button"
          aria-pressed={pendingDestructive === 'remove'}
          className={cn(
            'min-h-9 rounded-[var(--radius-sm)] px-1 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50',
            pendingDestructive === 'remove'
              ? 'font-semibold text-danger'
              : 'text-text-muted hover:text-danger',
          )}
          onClick={() => void handleRemove()}
        >
          {pendingDestructive === 'remove' ? 'Tap again to remove' : 'Remove mate'}
        </button>
        <button
          type="button"
          aria-pressed={pendingDestructive === 'block'}
          className={cn(
            'min-h-9 rounded-[var(--radius-sm)] px-1 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50',
            pendingDestructive === 'block'
              ? 'font-semibold text-danger'
              : 'text-text-muted hover:text-danger',
          )}
          onClick={() => void handleBlock()}
        >
          {pendingDestructive === 'block' ? 'Tap again to block' : 'Block'}
        </button>
      </div>
      {pendingDestructive === 'block' ? (
        <p role="status" className="text-right text-[0.6875rem] text-danger">
          Blocking is permanent — they can never reconnect.
        </p>
      ) : null}
    </div>
  )
}

function MateChallengeCard({ challenge }: { challenge: MateChallengeItem }) {
  const { toast } = useToast()
  const respond = useRespondMateChallenge()
  const cancel = useCancelMateChallenge()

  const opponentName = formatProfileName(challenge.opponent)
  const ended = challenge.ends_at !== null && new Date(challenge.ends_at) <= new Date()
  const winning = challenge.my_total > challenge.their_total
  const tied = challenge.my_total === challenge.their_total
  const myScore = useCountUp(challenge.my_total)
  const theirScore = useCountUp(challenge.their_total)

  async function handleRespond(accept: boolean) {
    try {
      await respond.mutateAsync({ challengeId: challenge.id, accept })
      if (accept) {
        successHaptic()
      }
      toast({
        message: accept ? 'Challenge on. Bank everything you have.' : 'Challenge declined.',
        variant: 'success',
      })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not respond.'), variant: 'danger' })
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync(challenge.id)
      toast({ message: 'Challenge cancelled.', variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not cancel the challenge.'), variant: 'danger' })
    }
  }

  return (
    <Card padding="md" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-text-primary">
          You vs {opponentName} · {challenge.duration_days}d
        </p>
        {challenge.status === 'pending' ? (
          <Badge variant="accent" className="shrink-0">
            {challenge.is_challenger ? 'Waiting' : 'Your call'}
          </Badge>
        ) : ended ? (
          <Badge
            variant={winning ? 'success' : 'neutral'}
            className={cn('shrink-0', winning && 'motion-pop')}
          >
            {tied ? 'Draw' : winning ? 'You won 🏆' : `${opponentName} won`}
          </Badge>
        ) : (
          <Badge variant="success" className="shrink-0">
            Live
          </Badge>
        )}
      </div>

      {challenge.status === 'active' ? (
        <>
          <div className="flex items-center justify-between font-mono text-2xl font-bold">
            <span className={winning ? 'text-success' : 'text-text-primary'}>
              {myScore.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-text-muted">vs</span>
            <span className={!winning && !tied ? 'text-success' : 'text-text-primary'}>
              {theirScore.toLocaleString()}
            </span>
          </div>
          {!ended && challenge.ends_at ? (
            <p className="text-xs text-text-muted">
              Ends {formatDistanceToNowStrict(new Date(challenge.ends_at), { addSuffix: true })}
            </p>
          ) : null}
        </>
      ) : null}

      {challenge.status === 'pending' && !challenge.is_challenger ? (
        <div className="flex gap-2">
          <Button
            className="min-h-9 flex-1 text-sm"
            loading={respond.isPending}
            onClick={() => void handleRespond(true)}
          >
            Accept
          </Button>
          <Button
            variant="secondary"
            className="min-h-9 flex-1 text-sm"
            loading={respond.isPending}
            onClick={() => void handleRespond(false)}
          >
            Decline
          </Button>
        </div>
      ) : null}

      {challenge.status === 'pending' && challenge.is_challenger ? (
        <button
          type="button"
          disabled={cancel.isPending}
          className="text-xs text-text-muted transition-colors hover:text-danger disabled:opacity-60"
          onClick={() => void handleCancel()}
        >
          Cancel challenge
        </button>
      ) : null}
    </Card>
  )
}

export function MatesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { activeGroup } = useActiveGroup()
  const {
    data: mates = [],
    isLoading: matesLoading,
    error: matesError,
    refetch: refetchMates,
  } = useMates()
  const { data: leaderboard = [] } = useMateLeaderboard(7)
  const { data: challenges = [] } = useMateChallenges()
  const { data: mateCode, isLoading: mateCodeLoading } = useMyMateCode()
  const { data: receivedNudges = [] } = useReceivedNudges(user?.id)
  const { data: members = [] } = useGroupMembers(activeGroup?.id)
  const respondRequest = useRespondMateRequest()
  const requestMate = useRequestMate()
  const rotateCode = useRotateMateCode()
  const removeMate = useRemoveMate()
  const [expandedMateId, setExpandedMateId] = useState<string | null>(null)
  // Track which outgoing request is being withdrawn so only its row spins.
  const [cancellingOutgoingId, setCancellingOutgoingId] = useState<string | null>(null)
  // Rotating invalidates every link already shared, so arm-to-confirm first;
  // a stale armed state auto-disarms after 4s (matching the mate remove/block flow).
  const [rotateArmed, setRotateArmed] = useState(false)
  // Reveal a persistent select-all link when the clipboard write is blocked.
  const [copyFailed, setCopyFailed] = useState(false)

  useEffect(() => {
    if (!rotateArmed) return
    const timer = window.setTimeout(() => setRotateArmed(false), 4000)
    return () => window.clearTimeout(timer)
  }, [rotateArmed])

  const accepted = mates.filter((mate) => mate.status === 'accepted')
  const incoming = mates.filter((mate) => mate.status === 'pending' && mate.direction === 'incoming')
  const outgoing = mates.filter((mate) => mate.status === 'pending' && mate.direction === 'outgoing')

  const connectedIds = useMemo(
    () => new Set(mates.map((mate) => mate.user.id)),
    [mates],
  )
  const addableMembers = members.filter(
    (member) =>
      member.user_id !== user?.id && member.profiles && !connectedIds.has(member.user_id),
  )

  // Prefer the canonical app URL (as invite links do) so a shared mate link
  // never points at a dev/preview origin; fall back to the current origin.
  const mateLinkOrigin =
    appConfig.url || (typeof window !== 'undefined' ? window.location.origin : '')
  const mateLink = mateCode ? `${mateLinkOrigin}/mates/add/${mateCode}` : null
  const now = Date.now()
  const isEndedBattle = (challenge: MateChallengeItem) =>
    challenge.status === 'active' &&
    challenge.ends_at !== null &&
    new Date(challenge.ends_at).getTime() <= now
  const liveChallenges = challenges.filter(
    (challenge) =>
      (challenge.status === 'pending' || challenge.status === 'active') &&
      !isEndedBattle(challenge),
  )
  const recentResults = challenges.filter(
    (challenge) =>
      isEndedBattle(challenge) &&
      new Date(challenge.ends_at!).getTime() > now - 7 * 24 * 60 * 60 * 1000,
  )

  async function handleCopyLink() {
    if (!mateLink) return
    try {
      await navigator.clipboard.writeText(mateLink)
      setCopyFailed(false)
      toast({ message: 'Mate link copied. Send it to anyone.', variant: 'success' })
    } catch {
      setCopyFailed(true)
      toast({ message: 'Could not copy link. Select the text below.', variant: 'danger' })
    }
  }

  async function handleRotate() {
    if (!rotateArmed) {
      setRotateArmed(true)
      return
    }

    setRotateArmed(false)
    try {
      await rotateCode.mutateAsync()
      toast({
        message: 'Mate link rotated — the old link no longer works.',
        variant: 'success',
      })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not rotate your mate link.'), variant: 'danger' })
    }
  }

  async function handleRespond(connectionId: string, accept: boolean, requesterId?: string) {
    try {
      await respondRequest.mutateAsync({ connectionId, accept, requesterId })
      if (accept) {
        successHaptic()
      }
      toast({ message: accept ? 'Mates locked in. 💪' : 'Request declined.', variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not respond.'), variant: 'danger' })
    }
  }

  async function handleRequest(userId: string) {
    try {
      await requestMate.mutateAsync(userId)
      toast({ message: 'Mate request sent.', variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not send request.'), variant: 'danger' })
    }
  }

  async function handleCancelOutgoing(connectionId: string) {
    setCancellingOutgoingId(connectionId)
    try {
      await removeMate.mutateAsync(connectionId)
      toast({ message: 'Request withdrawn.', variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not withdraw the request.'), variant: 'danger' })
    } finally {
      setCancellingOutgoingId(null)
    }
  }

  return (
    <AppLayout
      title="Mates"
      subtitle="Your crew across groups"
      showNav={false}
      headerLeading={<BackLink to="/group" label="Group" />}
    >
      <div className="motion-stagger space-y-6 pb-8">
        <Card padding="md" className="space-y-2">
          <p className="text-sm font-medium text-text-primary">Your mate link</p>
          <p className="text-xs text-text-muted">
            Anyone with this link becomes your mate when they open it — share it like a handshake.
          </p>
          <div className="flex gap-2">
            <Button
              className="min-h-10 flex-1 text-sm"
              loading={mateCodeLoading}
              disabled={!mateLink}
              onClick={() => void handleCopyLink()}
            >
              Copy mate link
            </Button>
            <Button
              variant={rotateArmed ? 'danger' : 'secondary'}
              className="min-h-10 shrink-0 px-3 text-sm"
              loading={rotateCode.isPending}
              onClick={() => void handleRotate()}
            >
              {rotateArmed ? 'Confirm' : 'Rotate'}
            </Button>
          </div>
          {rotateArmed ? (
            <p role="status" className="text-xs text-danger">
              Rotating makes your current link stop working — anyone you already sent it to will
              need the new one.
            </p>
          ) : null}
          {copyFailed && mateLink ? (
            <p className="select-all break-all rounded-[var(--radius-md)] bg-bg px-3 py-2 font-mono text-xs text-text-primary">
              {mateLink}
            </p>
          ) : null}
        </Card>

        {receivedNudges.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Recent nudges
            </h2>
            <Card padding="sm" className="space-y-1.5">
              {receivedNudges.map((nudge) => {
                const sender = mates.find((mate) => mate.user.id === nudge.sender_id)
                const name = sender ? formatProfileName(sender.user) : 'A mate'

                return (
                  <p key={nudge.id} className="text-sm text-text-primary">
                    {NUDGE_FEED_COPY[nudge.kind](name)}
                    <span className="ml-1.5 text-xs text-text-muted">
                      {formatDistanceToNowStrict(new Date(nudge.created_at), { addSuffix: true })}
                    </span>
                  </p>
                )
              })}
            </Card>
          </section>
        ) : null}

        {incoming.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Mate requests
            </h2>
            {incoming.map((mate) => (
              <Card key={mate.connection_id} padding="sm" className="flex items-center gap-3">
                <AvatarChip
                  emoji={mate.user.avatar_emoji}
                  name={formatProfileName(mate.user)}
                  className="flex-1 border-0 bg-transparent p-0"
                />
                <Button
                  className="min-h-9 px-3 text-sm"
                  loading={respondRequest.isPending}
                  onClick={() => void handleRespond(mate.connection_id, true, mate.user.id)}
                >
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-9 px-3 text-sm"
                  loading={respondRequest.isPending}
                  onClick={() => void handleRespond(mate.connection_id, false)}
                >
                  Decline
                </Button>
              </Card>
            ))}
          </section>
        ) : null}

        {liveChallenges.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              1v1 battles
            </h2>
            {liveChallenges.map((challenge) => (
              <MateChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </section>
        ) : null}

        {recentResults.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Recent results
            </h2>
            {recentResults.map((challenge) => (
              <MateChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </section>
        ) : null}

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Your mates
          </h2>
          {matesLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : matesError ? (
            <EmptyState
              title="Couldn't load your mates"
              description="Something went wrong. Check your connection and try again."
              icon={<span className="text-2xl">⚠️</span>}
              actionLabel="Try again"
              onAction={() => void refetchMates()}
            />
          ) : accepted.length === 0 ? (
            <EmptyState
              title="No mates yet"
              description="Add someone from your group below, or send your mate link. Once they accept, you can start a 1v1 push-up battle from their card."
              icon={<span className="text-2xl">🤝</span>}
            />
          ) : (
            <div className="space-y-2">
              {accepted.map((mate) => {
                const expanded = expandedMateId === mate.connection_id

                return (
                  <Card key={mate.connection_id} padding="sm" className="space-y-0">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => setExpandedMateId(expanded ? null : mate.connection_id)}
                      aria-expanded={expanded}
                    >
                      <AvatarChip
                        emoji={mate.user.avatar_emoji}
                        name={formatProfileName(mate.user)}
                        className="flex-1 border-0 bg-transparent p-0"
                      />
                      <span className="text-text-muted" aria-hidden="true">
                        {expanded ? '▾' : '▸'}
                      </span>
                    </button>
                    {expanded ? (
                      <MateDetail mate={mate} onClose={() => setExpandedMateId(null)} />
                    ) : null}
                  </Card>
                )
              })}
            </div>
          )}

          {outgoing.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-text-muted">Waiting on their reply</p>
              {outgoing.map((mate) => (
                <Card key={mate.connection_id} padding="sm" className="flex items-center gap-3">
                  <AvatarChip
                    emoji={mate.user.avatar_emoji}
                    name={formatProfileName(mate.user)}
                    className="flex-1 border-0 bg-transparent p-0"
                  />
                  <Button
                    variant="ghost"
                    className="min-h-9 px-3 text-sm text-text-muted"
                    loading={cancellingOutgoingId === mate.connection_id}
                    disabled={removeMate.isPending && cancellingOutgoingId !== mate.connection_id}
                    onClick={() => void handleCancelOutgoing(mate.connection_id)}
                  >
                    Cancel
                  </Button>
                </Card>
              ))}
            </div>
          ) : null}
        </section>

        {addableMembers.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Add from {activeGroup?.name ?? 'your group'}
            </h2>
            {addableMembers.map((member) => (
              <Card key={member.user_id} padding="sm" className="flex items-center gap-3">
                <AvatarChip
                  emoji={member.profiles?.avatar_emoji ?? '💪'}
                  name={member.profiles?.display_name ?? 'Member'}
                  className="flex-1 border-0 bg-transparent p-0"
                />
                <Button
                  variant="secondary"
                  className="min-h-9 px-3 text-sm"
                  loading={requestMate.isPending}
                  onClick={() => void handleRequest(member.user_id)}
                >
                  Add mate
                </Button>
              </Card>
            ))}
          </section>
        ) : null}

        {leaderboard.length > 1 ? (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Mate board — last 7 days
            </h2>
            <Card padding="sm">
              <ul className="divide-y divide-border">
                {leaderboard.map((row, index) => (
                  <li key={row.user_id} className="flex items-center gap-3 py-2">
                    <span className="w-5 text-center font-mono text-sm text-text-muted">
                      {index + 1}
                    </span>
                    <AvatarChip
                      emoji={row.avatar_emoji}
                      name={row.user_id === user?.id ? 'You' : formatProfileName(row)}
                      className="flex-1 border-0 bg-transparent p-0"
                    />
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {row.total.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}

        <p className="text-center text-xs text-text-muted">
          Mates see aggregate stats only — never your individual entries or groups.
        </p>
      </div>
    </AppLayout>
  )
}
