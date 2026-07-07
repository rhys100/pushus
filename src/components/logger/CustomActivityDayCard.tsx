import { ActivityIcon } from '@/components/ui/ActivityIcon'
import { cn } from '@/lib/cn'
import type { CustomActivity, CustomActivityEntry } from '@/types/customActivity'

export type CustomActivityDayCardProps = {
  activity: CustomActivity
  entries: CustomActivityEntry[]
  /** All-time best single set (includes today); 0 = never logged. */
  allTimeBest?: number
  className?: string
}

/** Today's tally for the selected custom activity — replaces the plan card. */
export function CustomActivityDayCard({
  activity,
  entries,
  allTimeBest = 0,
  className,
}: CustomActivityDayCardProps) {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  const best = entries.reduce((max, entry) => Math.max(max, entry.count), 0)
  // Today's top set matches (or set) the record — celebrate right on the card.
  const recordIsToday = best > 0 && allTimeBest > 0 && best >= allTimeBest
  const leftTotal = entries
    .filter((entry) => entry.side === 'left')
    .reduce((sum, entry) => sum + entry.count, 0)
  const rightTotal = entries
    .filter((entry) => entry.side === 'right')
    .reduce((sum, entry) => sum + entry.count, 0)

  return (
    <div
      className={cn(
        'w-full rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3',
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
        <ActivityIcon icon={activity.emoji} className="h-3.5 w-3.5 text-accent" />
        {activity.name} — today
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-text-primary">
        {total}
        <span className="ml-1.5 text-sm font-medium text-text-muted">reps</span>
        {entries.length > 0 ? (
          <span className="ml-2 text-sm font-normal text-text-muted">
            · {entries.length} set{entries.length === 1 ? '' : 's'} · best {best}
          </span>
        ) : null}
      </p>
      {activity.track_sides && (leftTotal > 0 || rightTotal > 0) ? (
        <p className="mt-1 text-xs text-text-muted">
          Left <span className="font-mono font-semibold text-text-primary">{leftTotal}</span>
          {' · '}
          Right <span className="font-mono font-semibold text-text-primary">{rightTotal}</span>
        </p>
      ) : null}
      {recordIsToday ? (
        <p className="mt-1 text-xs font-semibold text-accent">
          🏆 All-time best set — {best} today
        </p>
      ) : allTimeBest > 0 ? (
        <p className="mt-1 text-xs text-text-muted">
          All-time best{' '}
          <span className="font-mono font-semibold text-text-primary">{allTimeBest}</span>
        </p>
      ) : null}
    </div>
  )
}
