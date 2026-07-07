import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { getGroupLocalDateString } from '@/hooks/useTodayData'
import { useActivityProgressRows, type ProgressSelection } from '@/hooks/useActivityProgress'
import { useCustomActivities } from '@/hooks/useCustomActivities'
import {
  aggregateDailyProgress,
  aggregateWeeklyProgress,
  metricValue,
  progressIsEmpty,
  progressQueryStartDate,
  progressTrend,
  type ProgressMetric,
  type ProgressRange,
} from '@/lib/progressStats'
import type { Group } from '@/types/database'
import { SegmentedControl, Skeleton } from '@/components/ui'
import { ProgressChart, type ProgressChartSeries } from '@/components/progress/ProgressChart'

const RANGE_OPTIONS: { value: ProgressRange; label: string }[] = [
  { value: 'daily', label: '2 weeks' },
  { value: 'weekly', label: '12 weeks' },
]

const METRIC_OPTIONS: { value: ProgressMetric; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'best', label: 'Best set' },
]

const RIGHT_SIDE_COLOR = '#5aa9ff'

export type MyProgressPanelProps = {
  group: Group
  userId: string
  timezone: string
  className?: string
}

/**
 * Personal progression section on the Board: pick an activity (push-ups or a
 * custom one), see daily/weekly totals or best-set trends over time.
 */
export function MyProgressPanel({ group, userId, timezone, className }: MyProgressPanelProps) {
  const { data: activities = [] } = useCustomActivities(userId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [range, setRange] = useState<ProgressRange>('daily')
  const [metric, setMetric] = useState<ProgressMetric>('total')

  const selectedActivity = activities.find((activity) => activity.id === selectedId) ?? null
  const selection: ProgressSelection = selectedActivity
    ? { kind: 'custom', activityId: selectedActivity.id }
    : { kind: 'pushups' }

  const today = getGroupLocalDateString(timezone)
  const startDate = progressQueryStartDate(today, range)
  const { data: rows = [], isLoading } = useActivityProgressRows(
    selection,
    group,
    userId,
    startDate,
  )

  const points = useMemo(
    () =>
      range === 'daily'
        ? aggregateDailyProgress(rows, today)
        : aggregateWeeklyProgress(rows, today),
    [range, rows, today],
  )

  const sided = selectedActivity?.track_sides ?? false
  const chartSeries: ProgressChartSeries[] = useMemo(() => {
    if (sided) {
      return [
        {
          name: 'Left',
          color: 'var(--color-accent)',
          values: points.map((point) => metricValue(point, metric, 'left')),
        },
        {
          name: 'Right',
          color: RIGHT_SIDE_COLOR,
          values: points.map((point) => metricValue(point, metric, 'right')),
        },
      ]
    }

    return [
      {
        name: metric === 'total' ? 'Total reps' : 'Best set',
        color: 'var(--color-accent)',
        values: points.map((point) => metricValue(point, metric)),
      },
    ]
  }, [metric, points, sided])

  const labels = useMemo(() => points.map((point) => point.label), [points])
  const trend = progressTrend(points, metric)
  const empty = progressIsEmpty(points)
  const activityName = selectedActivity ? selectedActivity.name : 'Push-ups'
  const bucketNoun = range === 'daily' ? 'day' : 'week'

  return (
    <section
      aria-label="My progress"
      className={cn(
        'rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-4',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">My progress</h2>
        <p className="text-xs text-text-muted">Only you can see this</p>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Progress activity">
        <ActivityChip
          label="💪 Push-ups"
          selected={selectedActivity == null}
          onClick={() => setSelectedId(null)}
        />
        {activities.map((activity) => (
          <ActivityChip
            key={activity.id}
            label={`${activity.emoji} ${activity.name}`}
            selected={selectedId === activity.id}
            onClick={() => setSelectedId(activity.id)}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SegmentedControl
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
          ariaLabel="Progress time range"
        />
        <SegmentedControl
          options={METRIC_OPTIONS}
          value={metric}
          onChange={setMetric}
          ariaLabel="Progress metric"
        />
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-36 w-full rounded-[var(--radius-md)]" />
        ) : empty ? (
          <p className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-6 text-center text-xs text-text-muted">
            No {activityName} logged in this range yet. Bank some sets and your trend
            shows up here.
          </p>
        ) : (
          <>
            <ProgressChart
              series={chartSeries}
              labels={labels}
              ariaLabel={`${activityName} ${metric === 'total' ? 'total reps' : 'best set'} per ${bucketNoun}`}
            />
            {sided ? (
              <div className="mt-2 flex items-center gap-4 text-xs text-text-muted">
                <LegendDot color="var(--color-accent)" label="Left" />
                <LegendDot color={RIGHT_SIDE_COLOR} label="Right" />
              </div>
            ) : null}
          </>
        )}
      </div>

      {trend ? (
        <p className="mt-3 text-xs text-text-muted">
          This {bucketNoun}{' '}
          <span className="font-mono font-semibold text-text-primary">{trend.current}</span>
          {' · '}last {bucketNoun}{' '}
          <span className="font-mono font-semibold text-text-primary">{trend.previous}</span>
          {trend.delta !== 0 ? (
            <span
              className={cn(
                'ml-2 font-mono font-semibold',
                trend.delta > 0 ? 'text-success' : 'text-danger',
              )}
            >
              {trend.delta > 0 ? '+' : ''}
              {trend.delta}
            </span>
          ) : null}
        </p>
      ) : null}
    </section>
  )
}

function ActivityChip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-[var(--radius-full)] border px-3 py-1.5 text-xs font-semibold transition-colors',
        selected
          ? 'border-accent bg-accent-muted text-accent'
          : 'border-border bg-bg text-text-muted hover:border-accent/30',
      )}
    >
      {label}
    </button>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
