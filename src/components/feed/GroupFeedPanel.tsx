import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { cn } from '@/lib/cn'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  REACTION_EMOJIS,
  canReactToFeedItem,
  useActivityFeed,
  useToggleReaction,
  useUserEntryReactions,
  type ActivityFeedItem,
  type ReactionEmoji,
} from '@/hooks/useActivityFeed'
import { useAuth } from '@/providers/AuthProvider'
import { tapHaptic } from '@/lib/haptics'
import { EmptyState, Skeleton } from '@/components/ui'

function formatRelativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return 'recently'
  }
}

function feedItemSummary(item: ActivityFeedItem): string {
  if (item.event_type === 'daily_total') {
    return `hit ${item.count} for the day`
  }

  if (item.event_type === 'leaderboard_total') {
    return `is on ${item.count} reps this week`
  }

  return `banked ${item.count} push-up${item.count === 1 ? '' : 's'}`
}

type ActivityFeedRowProps = {
  item: ActivityFeedItem
  currentUserId: string | undefined
  userReactions: Set<string>
  onToggleReaction: (entryId: string, emoji: ReactionEmoji) => void
  reactionPending: boolean
  dense?: boolean
}

function reactionKey(entryId: string, emoji: string): string {
  return `${entryId}:${emoji}`
}

const FEED_DENSITY_KEY = 'pushus-feed-density'

function readFeedDense(): boolean {
  try {
    return localStorage.getItem(FEED_DENSITY_KEY) === 'compact'
  } catch {
    return false
  }
}

function writeFeedDense(dense: boolean): void {
  try {
    localStorage.setItem(FEED_DENSITY_KEY, dense ? 'compact' : 'comfortable')
  } catch {
    // ignore quota / private mode
  }
}

function ActivityFeedRow({
  item,
  currentUserId,
  userReactions,
  onToggleReaction,
  reactionPending,
  dense = false,
}: ActivityFeedRowProps) {
  const showReactionButtons = canReactToFeedItem(item, currentUserId)
  const showReactionCount = item.event_type === 'entry' && item.reaction_count > 0
  const summary = `${item.display_name} ${feedItemSummary(item)}`

  return (
    <li className={cn('border-b border-border/25 last:border-b-0', dense ? 'px-4 py-2' : 'px-4 py-3.5')}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border border-border bg-bg',
            dense ? 'h-8 w-8 text-base' : 'h-10 w-10 text-lg',
          )}
          aria-hidden="true"
        >
          {item.avatar_emoji}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-text-primary">{summary}</p>
          {dense ? null : (
            <p className="mt-0.5 text-xs text-text-muted">{formatRelativeTime(item.created_at)}</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              'font-mono font-bold tabular-nums text-text-primary',
              dense ? 'text-base' : 'text-lg',
            )}
          >
            {item.count}
          </p>
          {dense ? (
            <p className="text-[0.625rem] text-text-muted">{formatRelativeTime(item.created_at)}</p>
          ) : (
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-text-muted">
              reps
            </p>
          )}
        </div>
      </div>

      {showReactionButtons || showReactionCount ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[3.25rem]">
          {showReactionButtons
            ? REACTION_EMOJIS.map((emoji) => {
                const active = userReactions.has(reactionKey(item.event_id, emoji))

                return (
                  <button
                    key={emoji}
                    type="button"
                    disabled={reactionPending}
                    aria-pressed={active}
                    aria-label={`React with ${emoji}`}
                    onClick={() => {
                      tapHaptic()
                      onToggleReaction(item.event_id, emoji)
                    }}
                    className={cn(
                      'inline-flex min-h-8 min-w-8 items-center justify-center rounded-[var(--radius-full)]',
                      'border text-sm transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                      'active:scale-90',
                      active
                        ? 'motion-pop border-accent/40 bg-accent-muted'
                        : 'border-border bg-bg hover:border-accent/30',
                      reactionPending && 'opacity-60',
                    )}
                  >
                    {emoji}
                  </button>
                )
              })
            : null}

          {showReactionCount ? (
            <span className="text-[0.6875rem] text-text-muted">
              {item.reaction_count} reaction{item.reaction_count === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export function ActivityFeedSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-3 border-b border-border/25 px-4 py-3.5 last:border-b-0">
          <Skeleton className="h-10 w-full rounded-[var(--radius-full)]" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function GroupFeedPanel() {
  const { user } = useAuth()
  const { activeGroup } = useActiveGroup()
  const { data: feed = [], isLoading, isError, isFetching, refetch } = useActivityFeed(activeGroup)
  const { data: userReactionRows = [] } = useUserEntryReactions(activeGroup, feed, user?.id)
  const toggleReaction = useToggleReaction(activeGroup, user?.id)

  const userReactions = new Set(
    userReactionRows.map((row) => reactionKey(row.target_id, row.emoji)),
  )
  const showInitialSkeleton = isLoading && feed.length === 0
  const [dense, setDense] = useState(readFeedDense)

  const toggleDense = () => {
    setDense((on) => {
      writeFeedDense(!on)
      return !on
    })
  }

  const handleToggleReaction = (entryId: string, emoji: ReactionEmoji) => {
    if (!activeGroup || toggleReaction.isPending) {
      return
    }

    const targetItem = feed.find((item) => item.event_type === 'entry' && item.event_id === entryId)
    if (targetItem && !canReactToFeedItem(targetItem, user?.id)) {
      return
    }

    toggleReaction.mutate({ group: activeGroup, entryId, emoji })
  }

  return (
    <>
      {isFetching && feed.length > 0 ? (
        <p className="mb-3 text-xs text-text-muted" aria-live="polite">
          Refreshing…
        </p>
      ) : null}

      {showInitialSkeleton ? <ActivityFeedSkeleton /> : null}

      {!showInitialSkeleton && isError ? (
        <EmptyState
          className="rounded-[var(--radius-lg)] border border-border bg-surface"
          title="Could not load activity"
          description="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      ) : null}

      {!showInitialSkeleton && !isError && feed.length === 0 ? (
        <EmptyState
          title={
            activeGroup?.feed_visibility === 'leaderboard_totals'
              ? 'Feed is off for this group'
              : 'No activity yet'
          }
          description={
            activeGroup?.feed_visibility === 'leaderboard_totals'
              ? 'This group shows leaderboard totals only — check the Board to see how everyone is going.'
              : 'When mates bank push-ups, their entries will appear here.'
          }
          icon={
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h3l2-7 4 14 2-7h5" />
            </svg>
          }
        />
      ) : null}

      {!showInitialSkeleton && !isError && feed.length > 0 ? (
        <>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={toggleDense}
              aria-pressed={dense}
              aria-label={dense ? 'Switch to comfortable feed density' : 'Switch to compact feed density'}
              className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-full)] px-2.5 text-xs font-medium text-text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {dense ? '☰ Comfortable' : '≡ Compact'}
            </button>
          </div>
          <ul
            className="motion-stagger overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface"
            aria-label="Recent group activity"
          >
            {feed.map((item) => (
              <ActivityFeedRow
                key={`${item.event_type}-${item.event_id}`}
                item={item}
                currentUserId={user?.id}
                userReactions={userReactions}
                onToggleReaction={handleToggleReaction}
                reactionPending={toggleReaction.isPending}
                dense={dense}
              />
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}
