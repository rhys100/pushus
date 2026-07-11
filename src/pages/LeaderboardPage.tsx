import { memo, useState } from 'react'
import { cn } from '@/lib/cn'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useFlipList } from '@/hooks/useFlipList'
import { getMemberDayTarget, useGroupDailyTargets } from '@/hooks/useGroupDailyTargets'
import { useGroupStreaks } from '@/hooks/useGroupStreaks'
import {
  useLeaderboard,
  useLeaderboardPeriod,
  useMyJoinDate,
  type LeaderboardEntry,
  type LeaderboardMetric,
} from '@/hooks/useLeaderboard'
import { getGroupLocalDateString } from '@/hooks/useTodayData'
import { officialScoringStartsAt } from '@/lib/gamification/lateJoiner'
import { formatPeriodLabel, type LeaderboardRange } from '@/lib/leaderboardCalc'
import type { MemberDayTarget } from '@/lib/training/resolveMemberTodayTarget'
import { useAuth } from '@/providers/AuthProvider'
import { useTabPageMeta } from '@/components/layout/TabPageMeta'
import { MyProgressPanel } from '@/components/progress/MyProgressPanel'
import { useProfile } from '@/hooks/useProfile'
import {
  AvatarChip,
  Badge,
  EmptyState,
  GoalProgressBar,
  GoalProgressFraction,
  SegmentedControl,
  Skeleton,
} from '@/components/ui'

const RANGE_OPTIONS: { value: LeaderboardRange; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const RANGE_ARIA_LABELS: Record<LeaderboardRange, string> = {
  day: 'Daily leaderboard rankings',
  week: 'Weekly leaderboard rankings',
  month: 'Monthly leaderboard rankings',
}

const METRIC_OPTIONS: { value: LeaderboardMetric; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'biggest_set', label: 'Biggest set' },
  { value: 'most_improved', label: 'Most improved' },
]

/** Unit caption under a row's value; most-improved spells out the period. */
function metricUnitLabel(metric: LeaderboardMetric, range: LeaderboardRange): string {
  if (metric === 'biggest_set') return 'best set'
  if (metric === 'most_improved') return `vs last ${range === 'month' ? 'month' : 'week'}`
  return 'reps'
}

/** Signed delta for most-improved; plain number otherwise. */
function formatMetricValue(metric: LeaderboardMetric, value: number): string {
  if (metric === 'most_improved' && value > 0) {
    return `+${value.toLocaleString()}`
  }
  return value.toLocaleString()
}

function rankBadgeVariant(rank: number): 'accent' | 'warning' | 'neutral' {
  if (rank === 1) return 'accent'
  if (rank === 2 || rank === 3) return 'warning'
  return 'neutral'
}

function displayRank(entry: LeaderboardEntry, index: number, allZero: boolean): number {
  return allZero ? index + 1 : entry.rank
}

function RankBadge({ rank, muted }: { rank: number; muted?: boolean }) {
  const labels: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' }
  const label = muted ? `#${rank}` : (labels[rank] ?? `#${rank}`)

  return (
    <Badge
      variant={muted ? 'neutral' : rankBadgeVariant(rank)}
      className="min-w-[2.75rem] justify-center tabular-nums"
    >
      {label}
    </Badge>
  )
}

type LeaderboardRowProps = {
  entry: LeaderboardEntry
  isCurrentUser: boolean
  rank: number
  allZero: boolean
  dayTarget?: MemberDayTarget
  showDayProgress?: boolean
  targetsLoading?: boolean
  streak?: number
  metric?: LeaderboardMetric
  range?: LeaderboardRange
}

/** Streaks under 2 days aren't worth a flame yet. */
function StreakFlame({ streak }: { streak?: number }) {
  if (!streak || streak < 2) {
    return null
  }

  return (
    <span
      className="shrink-0 font-mono text-xs font-semibold tabular-nums text-warning"
      title={`${streak}-day streak`}
      aria-label={`${streak}-day streak`}
    >
      🔥{streak}
    </span>
  )
}

const LeaderboardRow = memo(function LeaderboardRow({
  entry,
  isCurrentUser,
  rank,
  allZero,
  dayTarget,
  showDayProgress = false,
  targetsLoading = false,
  streak,
  metric = 'total',
  range = 'week',
}: LeaderboardRowProps) {
  const hasTrainingTarget =
    dayTarget?.hasPlan && !dayTarget.isRestDay && dayTarget.target != null && dayTarget.target > 0
  const progressPercent =
    hasTrainingTarget && dayTarget?.target
      ? Math.min(100, Math.round((entry.total / dayTarget.target) * 100))
      : null

  if (showDayProgress) {
    return (
      <li
        data-flip-key={entry.user_id}
        className={cn(
          'flex min-w-0 items-center gap-2 px-4 py-2.5',
          isCurrentUser && 'bg-accent-muted/30',
        )}
      >
        <RankBadge rank={rank} muted={allZero || entry.total === 0} />

        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-bg text-base leading-none"
          aria-hidden="true"
        >
          {entry.avatar_emoji}
        </span>

        <p className="w-24 min-w-0 shrink truncate text-sm font-medium text-text-primary">
          {entry.display_name}
        </p>

        <StreakFlame streak={streak} />

        {targetsLoading ? (
          <Skeleton className="h-2.5 min-w-8 flex-1 rounded-[var(--radius-full)]" />
        ) : hasTrainingTarget && dayTarget?.target ? (
          <GoalProgressBar
            inline
            current={entry.total}
            target={dayTarget.target}
            className="min-w-8 flex-1"
            ariaLabel={`${entry.display_name} daily push-up progress`}
          />
        ) : (
          <span className="min-w-8 flex-1" aria-hidden="true" />
        )}

        {targetsLoading ? (
          <Skeleton className="h-4 w-12 shrink-0" />
        ) : isCurrentUser ? (
          // Your own row always shows a real value regardless of privacy —
          // fraction when you're training, otherwise Rest or your raw total.
          hasTrainingTarget && dayTarget?.target ? (
            <GoalProgressFraction
              current={entry.total}
              target={dayTarget.target}
              isRestDay={dayTarget.isRestDay}
              className="shrink-0"
            />
          ) : dayTarget?.isRestDay ? (
            <span className="shrink-0 text-xs font-medium text-text-muted">Rest</span>
          ) : (
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-text-primary">
              {entry.total}
              <span className="ml-1 text-2xs font-medium text-text-muted">reps</span>
            </span>
          )
        ) : entry.show_rep_totals ? (
          // Member opted in to public rep totals — show the raw number, not %.
          hasTrainingTarget && dayTarget?.target ? (
            <GoalProgressFraction
              current={entry.total}
              target={dayTarget.target}
              isRestDay={dayTarget.isRestDay}
              className="shrink-0"
            />
          ) : (
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-text-primary">
              {entry.total}
              <span className="ml-1 text-2xs font-medium text-text-muted">reps</span>
            </span>
          )
        ) : progressPercent != null ? (
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-text-primary">
            {progressPercent}%
          </span>
        ) : dayTarget?.isRestDay ? (
          <span className="shrink-0 text-xs font-medium text-text-muted">Rest</span>
        ) : (
          // Private member with no target — an explicit placeholder beats an
          // empty slot that reads as a broken row.
          <span className="shrink-0 text-xs font-medium text-text-muted">Private</span>
        )}
      </li>
    )
  }

  return (
    <li
      data-flip-key={entry.user_id}
      className={cn(
        'flex items-center gap-3 px-4 py-3.5',
        isCurrentUser && 'bg-accent-muted/30',
      )}
    >
      <RankBadge rank={rank} muted={allZero || entry.total === 0} />

      <div className="min-w-0 flex-1">
        <AvatarChip
          emoji={entry.avatar_emoji}
          name={entry.display_name}
          subtitle={isCurrentUser ? 'You' : undefined}
          active={isCurrentUser}
          className="w-full max-w-none border-0 bg-transparent px-0 py-0"
        />
      </div>

      <StreakFlame streak={streak} />

      <div className="shrink-0 text-right">
        <p
          className={cn(
            'font-mono text-xl font-bold tabular-nums',
            // Most-improved can regress: colour the delta by sign like the
            // progress trend line so a decline doesn't read as a gain.
            metric === 'most_improved' && entry.total > 0
              ? 'text-success'
              : metric === 'most_improved' && entry.total < 0
                ? 'text-danger'
                : 'text-text-primary',
          )}
        >
          {formatMetricValue(metric, entry.total)}
        </p>
        <p className="text-2xs font-medium uppercase tracking-wide text-text-muted">
          {metricUnitLabel(metric, range)}
        </p>
      </div>
    </li>
  )
})

function LeaderboardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 last:border-b-0"
        >
          <Skeleton className="h-6 w-11 rounded-[var(--radius-full)]" />
          <Skeleton className="h-10 flex-1 rounded-[var(--radius-full)]" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
  )
}

export function LeaderboardPage() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { activeGroup, loading: groupLoading } = useActiveGroup()
  const [range, setRange] = useState<LeaderboardRange>('day')
  // "Since you joined" scores everyone over the window the late joiner has
  // actually been present — official late-joiner fairness (locked rule).
  const [sinceJoin, setSinceJoin] = useState(false)
  // Metrics only apply to week/month periods; the day view has its own goal
  // progress. 'total' on the day view keeps the original behaviour.
  const [metric, setMetric] = useState<LeaderboardMetric>('total')
  const effectiveMetric: LeaderboardMetric =
    sinceJoin || range === 'day' ? 'total' : metric

  const timezone = activeGroup?.timezone || 'UTC'
  const todayIso = getGroupLocalDateString(timezone)
  const { data: joinDate } = useMyJoinDate(activeGroup?.id, user?.id)
  const joinIso = joinDate ? getGroupLocalDateString(timezone, new Date(joinDate)) : null

  const monthPeriod = useLeaderboardPeriod(activeGroup, 'month')
  // A late joiner for the current month gets the extra view + fairness note.
  const isRecentJoiner = Boolean(joinIso && monthPeriod && joinIso > monthPeriod.periodStart)

  const sinceJoinPeriod =
    sinceJoin && joinIso ? { periodStart: joinIso, periodEnd: todayIso } : null
  const rangePeriod = useLeaderboardPeriod(activeGroup, range)
  const period = sinceJoinPeriod ?? rangePeriod
  const { data: entries = [], isLoading, isError, isFetching, refetch } = useLeaderboard(
    activeGroup,
    range,
    effectiveMetric,
    sinceJoinPeriod,
  )
  const showDayProgress = range === 'day' && !sinceJoin
  const { data: dailyTargets, isLoading: targetsLoading } = useGroupDailyTargets(activeGroup, {
    enabled: showDayProgress,
  })
  const { data: streaks } = useGroupStreaks(activeGroup?.id)
  const subtitle = sinceJoin
    ? 'Since you joined'
    : period
      ? formatPeriodLabel(range, period.periodStart, period.periodEnd)
      : 'Today'
  const showInitialSkeleton = isLoading && entries.length === 0
  const allZero = entries.length > 0 && entries.every((entry) => entry.total === 0)

  // Rows glide to their new rank when the order changes (range switch,
  // someone banks) instead of teleporting.
  const listRef = useFlipList<HTMLUListElement>(entries)

  useTabPageMeta({
    // "Board" matches the bottom-nav label so the tab you tapped and the header
    // you land on share one name.
    title: 'Board',
    subtitle,
  })

  if (groupLoading || !activeGroup) {
    return <LeaderboardSkeleton />
  }

  const officialStart =
    isRecentJoiner && joinDate && (range === 'week' || range === 'month')
      ? officialScoringStartsAt(new Date(joinDate), range === 'week' ? 'weekly' : 'monthly', timezone)
      : null

  return (
    <>
      <SegmentedControl
        className="mb-3"
        options={RANGE_OPTIONS}
        value={range}
        onChange={(next) => {
          setRange(next)
          setSinceJoin(false)
        }}
        ariaLabel="Leaderboard time range"
      />

      {isRecentJoiner ? (
        <button
          type="button"
          onClick={() => setSinceJoin((on) => !on)}
          aria-pressed={sinceJoin}
          className={cn(
            'mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-full)] border px-3 text-sm font-medium transition-colors',
            sinceJoin
              ? 'border-accent bg-accent-muted text-text-primary'
              : 'border-border bg-bg text-text-muted hover:border-accent/30',
          )}
        >
          🗓️ Since you joined
        </button>
      ) : null}

      {!sinceJoin && range !== 'day' ? (
        <div className="mb-4">
          <SegmentedControl
            options={METRIC_OPTIONS}
            value={metric}
            onChange={setMetric}
            ariaLabel="Leaderboard metric"
          />
          {metric === 'most_improved' ? (
            <p className="mt-2 text-xs text-text-muted">
              Reps gained vs your previous {range === 'month' ? 'month' : 'week'}.
            </p>
          ) : null}
        </div>
      ) : null}

      {officialStart && !sinceJoin ? (
        <p className="mb-3 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-xs text-text-muted">
          You joined mid-{range}. Official {range}ly scoring counts from{' '}
          {officialStart.toLocaleDateString()} — tap{' '}
          <span className="font-medium text-text-primary">Since you joined</span> for a fair
          comparison meanwhile.
        </p>
      ) : null}

      {entries.length > 0 ? (
        // Kept mounted with a reserved line so a background refetch's hint
        // doesn't shove the list down when it appears and back when it ends.
        <p className="mb-3 min-h-4 text-xs text-text-muted" aria-live="polite">
          {isFetching ? 'Refreshing…' : ' '}
        </p>
      ) : null}

      {showInitialSkeleton ? <LeaderboardSkeleton /> : null}

      {!showInitialSkeleton && isError ? (
        <EmptyState
          className="rounded-[var(--radius-lg)] border border-border bg-surface"
          title="Could not load leaderboard"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      ) : null}

      {!showInitialSkeleton && !isError && entries.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Invite your crew to start competing on the board."
          icon={
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 20V10M12 20V4M16 20v-6" />
              <path strokeLinecap="round" d="M4 20h16" />
            </svg>
          }
        />
      ) : null}

      {!showInitialSkeleton && !isError && entries.length > 0 ? (
        <ul
          ref={listRef}
          className="motion-stagger overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface"
          aria-label={RANGE_ARIA_LABELS[range]}
        >
          {entries.map((entry, index) => (
            <LeaderboardRow
              key={entry.user_id}
              entry={entry}
              rank={displayRank(entry, index, allZero)}
              allZero={allZero}
              isCurrentUser={entry.user_id === user?.id}
              showDayProgress={showDayProgress}
              targetsLoading={targetsLoading}
              streak={streaks?.get(entry.user_id)}
              metric={effectiveMetric}
              range={range}
              dayTarget={
                showDayProgress
                  ? getMemberDayTarget(dailyTargets, entry.user_id)
                  : undefined
              }
            />
          ))}
        </ul>
      ) : null}

      {user ? (
        <MyProgressPanel
          className="mt-4"
          group={activeGroup}
          userId={user.id}
          timezone={profile?.timezone || activeGroup.timezone || 'UTC'}
        />
      ) : null}
    </>
  )
}
