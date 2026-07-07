import { cn } from '@/lib/cn'
import type { CustomActivity, CustomActivityEntry } from '@/types/customActivity'

export type CustomActivityDayCardProps = {
  activity: CustomActivity
  entries: CustomActivityEntry[]
  className?: string
}

/** Today's tally for the selected custom activity — replaces the plan card. */
export function CustomActivityDayCard({
  activity,
  entries,
  className,
}: CustomActivityDayCardProps) {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  const best = entries.reduce((max, entry) => Math.max(max, entry.count), 0)
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
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {activity.emoji} {activity.name} — today
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
    </div>
  )
}
