import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/cn'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  useLeaderboard,
  useLeaderboardPeriod,
  type LeaderboardEntry,
} from '@/hooks/useLeaderboard'
import { useAuth } from '@/providers/AuthProvider'
import { useTabPageMeta } from '@/components/layout/TabPageMeta'
import { AvatarChip, Badge, EmptyState, Skeleton } from '@/components/ui'

function formatPeriodLabel(periodStart: string, periodEnd: string): string {
  try {
    const start = format(parseISO(periodStart), 'd MMM')
    const end = format(parseISO(periodEnd), 'd MMM')
    return `${start} – ${end}`
  } catch {
    return 'This week'
  }
}

function rankBadgeVariant(rank: number): 'accent' | 'warning' | 'neutral' {
  if (rank === 1) return 'accent'
  if (rank === 2 || rank === 3) return 'warning'
  return 'neutral'
}

function RankBadge({ rank }: { rank: number }) {
  const labels: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' }
  const label = labels[rank] ?? `#${rank}`

  return (
    <Badge variant={rankBadgeVariant(rank)} className="min-w-[2.75rem] justify-center tabular-nums">
      {label}
    </Badge>
  )
}

type LeaderboardRowProps = {
  entry: LeaderboardEntry
  isCurrentUser: boolean
}

function LeaderboardRow({ entry, isCurrentUser }: LeaderboardRowProps) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-4 py-3.5',
        isCurrentUser && 'bg-accent-muted/30',
      )}
    >
      <RankBadge rank={entry.rank} />

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
  const { activeGroup, loading: groupLoading } = useActiveGroup()
  const period = useLeaderboardPeriod(activeGroup)
  const { data: entries = [], isLoading, isError, isFetching } = useLeaderboard(activeGroup)

  const subtitle = period ? formatPeriodLabel(period.periodStart, period.periodEnd) : 'This week'
  const hasLoggedReps = entries.some((entry) => entry.total > 0)
  const showInitialSkeleton = isLoading && entries.length === 0

  useTabPageMeta({
    title: 'Leaderboard',
    subtitle,
  })

  if (groupLoading || !activeGroup) {
    return <LeaderboardSkeleton />
  }

  return (
    <>
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

      {!showInitialSkeleton && !isError && !hasLoggedReps ? (
        <EmptyState
          title="Leaderboard empty"
          description="Once your crew starts logging, rankings will show here."
          icon={
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 20V10M12 20V4M16 20v-6" />
              <path strokeLinecap="round" d="M4 20h16" />
            </svg>
          }
        />
      ) : null}

      {!showInitialSkeleton && !isError && hasLoggedReps ? (
        <ul
          className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface"
          aria-label="Weekly leaderboard rankings"
        >
          {entries
            .filter((entry) => entry.total > 0)
            .map((entry) => (
              <LeaderboardRow
                key={entry.user_id}
                entry={entry}
                isCurrentUser={entry.user_id === user?.id}
              />
            ))}
        </ul>
      ) : null}
    </>
  )
}
