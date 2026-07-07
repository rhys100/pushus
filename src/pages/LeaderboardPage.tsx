import { useState } from 'react'
import { cn } from '@/lib/cn'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { getMemberDayTarget, useGroupDailyTargets } from '@/hooks/useGroupDailyTargets'
import {
  useLeaderboard,
  useLeaderboardPeriod,
  type LeaderboardEntry,
} from '@/hooks/useLeaderboard'
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
}

function LeaderboardRow({
  entry,
  isCurrentUser,
  rank,
  allZero,
  dayTarget,
  showDayProgress = false,
  targetsLoading = false,
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
        className={cn(
          'flex min-w-0 items-center gap-2 px-4 py-2.5',
          isCurrentUser && 'bg-accent-muted/30',
        )}
      >
        <RankBadge rank={rank} muted={allZero || entry.total === 0} />

        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-base leading-none"
          aria-hidden="true"
        >
          {entry.avatar_emoji}
        </span>

        <p className="w-[4.5rem] shrink-0 truncate text-sm font-medium text-text-primary">
          {entry.display_name}
        </p>

        {targetsLoading ? (
          <Skeleton className="h-2.5 min-w-12 flex-1 rounded-full" />
        ) : hasTrainingTarget && dayTarget?.target ? (
          <GoalProgressBar
            inline
            current={entry.total}
            target={dayTarget.target}
            className="min-w-12 flex-1"
            ariaLabel={`${entry.display_name} daily push-up progress`}
          />
        ) : (
          <span className="min-w-12 flex-1" aria-hidden="true" />
        )}

        {targetsLoading ? (
          <Skeleton className="h-4 w-12 shrink-0" />
        ) : isCurrentUser && hasTrainingTarget && dayTarget?.target ? (
          <GoalProgressFraction
            current={entry.total}
            target={dayTarget.target}
            isRestDay={dayTarget.isRestDay}
            className="shrink-0"
          />
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
              <span className="ml-1 text-[0.6875rem] font-medium text-text-muted">reps</span>
            </span>
          )
        ) : progressPercent != null ? (
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-text-primary">
            {progressPercent}%
          </span>
        ) : dayTarget?.isRestDay ? (
          <span className="shrink-0 text-xs font-medium text-text-muted">Rest</span>
        ) : null}
      </li>
    )
  }

  return (
    <li
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

      <div className="shrink-0 text-right">
        <p className="font-mono text-xl font-bold tabular-nums text-text-primary">{entry.total}</p>
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-text-muted">
          reps
        </p>
      </div>
    </li>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 last:border-b-0"
        >
          <Skeleton className="h-6 w-11 rounded-full" />
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
  const period = useLeaderboardPeriod(activeGroup, range)
  const { data: entries = [], isLoading, isError, isFetching } = useLeaderboard(
    activeGroup,
    range,
  )
  const showDayProgress = range === 'day'
  const { data: dailyTargets, isLoading: targetsLoading } = useGroupDailyTargets(activeGroup, {
    enabled: showDayProgress,
  })
  const subtitle = period
    ? formatPeriodLabel(range, period.periodStart, period.periodEnd)
    : 'Today'
  const showInitialSkeleton = isLoading && entries.length === 0
  const allZero = entries.length > 0 && entries.every((entry) => entry.total === 0)

  useTabPageMeta({
    title: 'Leaderboard',
    subtitle,
  })

  if (groupLoading || !activeGroup) {
    return <LeaderboardSkeleton />
  }

  return (
    <>
      <SegmentedControl
        className="mb-4"
        options={RANGE_OPTIONS}
        value={range}
        onChange={setRange}
        ariaLabel="Leaderboard time range"
      />

      {isFetching && entries.length > 0 ? (
        <p className="mb-3 text-xs text-text-muted" aria-live="polite">
          Refreshing…
        </p>
      ) : null}

      {showInitialSkeleton ? <LeaderboardSkeleton /> : null}

      {!showInitialSkeleton && isError ? (
        <EmptyState
          className="rounded-[var(--radius-lg)] border border-border bg-surface"
          title="Could not load leaderboard"
          description="Check your connection and try again."
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
          className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface"
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
