import { memo } from 'react'
import { cn } from '@/lib/cn'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { getDefaultPlan } from '@/lib/training/planEngine'

export type DayProgressCardProps = {
  bankedToday: number
  loading?: boolean
  dailyTarget?: number
  className?: string
}

export const DayProgressCard = memo(function DayProgressCard({
  bankedToday,
  loading = false,
  dailyTarget = getDefaultPlan().dailyTarget,
  className,
}: DayProgressCardProps) {
  const progress = dailyTarget > 0 ? Math.min(bankedToday / dailyTarget, 1) : 0
  const goalHit = bankedToday >= dailyTarget
  const remaining = Math.max(dailyTarget - bankedToday, 0)

  return (
    <Card padding="md" className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Today
          </p>

          {loading ? (
            <Skeleton className="mt-2 h-8 w-28" />
          ) : (
            <p className="mt-1 font-mono text-2xl font-bold leading-none text-text-primary">
              {bankedToday}
              <span className="ml-1.5 text-sm font-medium text-text-muted">
                banked
              </span>
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Goal
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
            {dailyTarget}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-[var(--radius-full)] bg-border/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={dailyTarget}
          aria-valuenow={bankedToday}
          aria-label="Daily push-up progress"
        >
          <div
            className={cn(
              'h-full rounded-[var(--radius-full)] transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-out)]',
              goalHit ? 'bg-success' : 'bg-accent',
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-text-muted">
          {loading ? (
            'Loading today…'
          ) : goalHit ? (
            'Daily goal hit — nice work.'
          ) : (
            <>
              <span className="font-medium text-text-primary">{remaining}</span> to go
            </>
          )}
        </p>
      </div>
    </Card>
  )
})
