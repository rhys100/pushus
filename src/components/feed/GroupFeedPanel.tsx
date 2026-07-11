import { memo, useCallback, useMemo, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { cn } from '@/lib/cn'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  REACTION_EMOJIS,
  canReactToFeedItem,
  useActivityFeed,
  useEntryReactions,
  useToggleReaction,
  type ActivityFeedItem,
  type EntryReaction,
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

/** Per-emoji tally for one entry: how many reacted, and whether I'm one. */
export type ReactionSummary = { emoji: ReactionEmoji; count: number; mine: boolean }

/** Shared stable empty array so entries with no reactions keep memo intact. */
const EMPTY_REACTIONS: ReactionSummary[] = []

type ActivityFeedRowProps = {
  item: ActivityFeedItem
  currentUserId: string | undefined
  reactions: ReactionSummary[]
  onToggleReaction: (entryId: string, emoji: ReactionEmoji) => void
  dense?: boolean
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

export const ActivityFeedRow = memo(function ActivityFeedRow({
  item,
  currentUserId,
  reactions,
  onToggleReaction,
  dense = false,
}: ActivityFeedRowProps) {
  const canReact = canReactToFeedItem(item, currentUserId)
  const hasReactions = reactions.length > 0
  const summary = `${item.display_name} ${feedItemSummary(item)}`
  // Parse/format the timestamp once per item, not on every panel re-render.
  const relativeTime = useMemo(() => formatRelativeTime(item.created_at), [item.created_at])

  // Existing reactions always show as tappable count chips (join in with a
  // tap); the full emoji palette (to add a *new* one) is tucked behind "+" so
  // a 50-item feed isn't a wall of buttons. Picking closes the palette.
  const [pickerOpen, setPickerOpen] = useState(false)
  const mineSet = useMemo(
    () => new Set(reactions.filter((reaction) => reaction.mine).map((reaction) => reaction.emoji)),
    [reactions],
  )

  const react = (emoji: ReactionEmoji) => {
    if (!canReact) return
    tapHaptic()
    onToggleReaction(item.event_id, emoji)
    setPickerOpen(false)
  }

  return (
    <li
      className={cn(
        'border-b border-border/25 last:border-b-0',
        dense ? 'px-3 py-1.5' : 'px-4 py-3.5',
      )}
    >
      <div className={cn('flex items-start', dense ? 'gap-2.5' : 'gap-3')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border border-border bg-bg',
            dense ? 'h-7 w-7 text-sm' : 'h-10 w-10 text-lg',
          )}
          aria-hidden="true"
        >
          {item.avatar_emoji}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'leading-snug text-text-primary',
              dense ? 'text-[0.8125rem]' : 'text-sm',
            )}
          >
            {summary}
          </p>
          {dense ? null : (
            <p className="mt-0.5 text-xs text-text-muted">{relativeTime}</p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              'font-mono font-bold tabular-nums text-text-primary',
              dense ? 'text-sm leading-tight' : 'text-lg',
            )}
          >
            {item.count}
          </p>
          {dense ? (
            <p className="text-[0.625rem] leading-tight text-text-muted">{relativeTime}</p>
          ) : (
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-text-muted">
              reps
            </p>
          )}
        </div>
      </div>

      {canReact || hasReactions ? (
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5',
            dense ? 'mt-1.5 pl-[2.375rem]' : 'mt-2 pl-[3.25rem]',
          )}
        >
          {pickerOpen && canReact ? (
            <>
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={mineSet.has(emoji)}
                  aria-label={`React with ${emoji}`}
                  onClick={() => react(emoji)}
                  className={cn(
                    'inline-flex items-center justify-center rounded-[var(--radius-full)] border',
                    'transition-[background-color,border-color,transform] duration-[var(--duration-fast)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-90',
                    dense ? 'h-10 w-10 text-lg' : 'h-11 w-11 text-xl',
                    mineSet.has(emoji)
                      ? 'motion-pop border-accent/50 bg-accent-muted'
                      : 'border-border bg-bg hover:border-accent/30',
                  )}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                aria-label="Close reaction picker"
                onClick={() => setPickerOpen(false)}
                className={cn(
                  'inline-flex items-center justify-center rounded-[var(--radius-full)] text-text-muted',
                  'transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                  dense ? 'h-10 w-10 text-base' : 'h-11 w-11 text-lg',
                )}
              >
                ×
              </button>
            </>
          ) : (
            <>
              {/* Existing reactions — tap a chip to join in or take yours back */}
              {reactions.map(({ emoji, count, mine }) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={!canReact}
                  aria-pressed={mine}
                  aria-label={`${emoji} ${count} reaction${count === 1 ? '' : 's'}${mine ? ', including you' : ''}${canReact ? ' — tap to toggle yours' : ''}`}
                  onClick={() => react(emoji)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-[var(--radius-full)] border font-medium tabular-nums',
                    'transition-[background-color,border-color,transform] duration-[var(--duration-fast)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    canReact && 'active:scale-90',
                    dense ? 'h-8 px-2 text-xs' : 'h-9 px-2.5 text-sm',
                    mine
                      ? 'border-accent/50 bg-accent-muted text-accent'
                      : 'border-border bg-bg text-text-primary',
                    !canReact && 'cursor-default',
                  )}
                >
                  <span aria-hidden="true">{emoji}</span>
                  <span>{count}</span>
                </button>
              ))}

              {/* Add a new reaction — opens the big emoji palette */}
              {canReact ? (
                <button
                  type="button"
                  aria-label="Add a reaction"
                  onClick={() => setPickerOpen(true)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-[var(--radius-full)] border border-border bg-bg text-text-muted',
                    'transition-colors hover:border-accent/30 hover:text-text-primary',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-95',
                    dense ? 'h-8 px-2.5' : 'h-9 px-3',
                  )}
                >
                  {hasReactions ? (
                    <span className="text-lg leading-none" aria-hidden="true">
                      +
                    </span>
                  ) : (
                    <>
                      <span aria-hidden="true">🙂</span>
                      <span className="text-sm font-medium">React</span>
                    </>
                  )}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </li>
  )
})

export function ActivityFeedSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-3 border-b border-border/25 px-4 py-3.5 last:border-b-0">
          <Skeleton className="h-10 w-full rounded-[var(--radius-full)]" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="ml-[3.25rem] h-8 w-24 rounded-[var(--radius-full)]" />
        </div>
      ))}
    </div>
  )
}

export function GroupFeedPanel() {
  const { user } = useAuth()
  const { activeGroup } = useActiveGroup()
  const { data: feed = [], isLoading, isError, isFetching, refetch } = useActivityFeed(activeGroup)
  const { data: reactionRows = [] } = useEntryReactions(activeGroup, feed, user?.id)
  const toggleReaction = useToggleReaction(activeGroup, user?.id)

  // Aggregate all group reactions into per-entry, per-emoji tallies once (not
  // per row, per render). Memoised on the raw rows so a background refetch that
  // returns equal data keeps stable array refs → React.memo rows don't churn.
  const reactionsByEntry = useMemo(() => {
    const rowsByEntry = new Map<string, EntryReaction[]>()
    for (const row of reactionRows) {
      const list = rowsByEntry.get(row.target_id)
      if (list) list.push(row)
      else rowsByEntry.set(row.target_id, [row])
    }

    const summaries = new Map<string, ReactionSummary[]>()
    for (const [entryId, rows] of rowsByEntry) {
      const summary: ReactionSummary[] = []
      for (const emoji of REACTION_EMOJIS) {
        let count = 0
        let mine = false
        for (const row of rows) {
          if (row.emoji === emoji) {
            count += 1
            if (row.user_id === user?.id) mine = true
          }
        }
        if (count > 0) summary.push({ emoji, count, mine })
      }
      summaries.set(entryId, summary)
    }
    return summaries
  }, [reactionRows, user?.id])
  const showInitialSkeleton = isLoading && feed.length === 0
  const [dense, setDense] = useState(readFeedDense)

  const toggleDense = useCallback(() => {
    setDense((on) => {
      writeFeedDense(!on)
      return !on
    })
  }, [])

  const toggleReactionMutate = toggleReaction.mutate
  // Optimistic UI carries the feedback; no global pending flag, so this stays a
  // stable identity that doesn't re-render every memoised row on each tap.
  const handleToggleReaction = useCallback(
    (entryId: string, emoji: ReactionEmoji) => {
      if (!activeGroup) {
        return
      }

      const targetItem = feed.find(
        (item) => item.event_type === 'entry' && item.event_id === entryId,
      )
      if (targetItem && !canReactToFeedItem(targetItem, user?.id)) {
        return
      }

      toggleReactionMutate({ group: activeGroup, entryId, emoji })
    },
    [activeGroup, feed, user?.id, toggleReactionMutate],
  )

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
                reactions={reactionsByEntry.get(item.event_id) ?? EMPTY_REACTIONS}
                onToggleReaction={handleToggleReaction}
                dense={dense}
              />
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}
