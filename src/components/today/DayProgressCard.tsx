import { memo, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { GoalProgressBar } from '@/components/ui/GoalProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { computeDailySetPlan } from '@/lib/training/dailySetPlan'
import type { TodayPrescription } from '@/lib/training/planEngine'

export type DayProgressCardProps = {
  bankedToday: number
  banksLogged?: number
  loading?: boolean
  hasPlan?: boolean
  dailyTarget?: number | null
  todayPrescription?: TodayPrescription | null
  variant?: 'default' | 'compact'
  className?: string
}

function dayTypeBadgeVariant(
  dayType: string,
): 'neutral' | 'accent' | 'success' | 'warning' {
  if (dayType === 'challenge') return 'accent'
  if (dayType === 'easy') return 'success'
  if (dayType === 'moderate') return 'neutral'
  return 'neutral'
}

export const DayProgressCard = memo(function DayProgressCard({
  bankedToday,
  banksLogged = 0,
  loading = false,
  hasPlan = false,
  dailyTarget,
  todayPrescription,
  variant = 'default',
  className,
}: DayProgressCardProps) {
  const prescription = todayPrescription
  const target = dailyTarget ?? prescription?.target ?? 0
  const isRestDay = !hasPlan || !prescription || prescription.isRestDay || target === 0

  const setPlan = useMemo(() => {
    if (!prescription || !hasPlan) {
      return null
    }
    return computeDailySetPlan(
      {
        dayType: prescription.dayType,
        target,
        setSize: prescription.setSize,
        sets: prescription.sets,
        isRestDay,
        dayTypeLabel: prescription.dayTypeLabel,
      },
      bankedToday,
      banksLogged,
    )
  }, [prescription, hasPlan, target, isRestDay, bankedToday, banksLogged])

  if (!hasPlan && !loading) {
    return (
      <Card
        padding="sm"
        data-testid="day-progress-card"
        className={cn('mt-3', className)}
      >
        <p className="text-sm font-medium text-text-primary">
          Set up a plan for sensible daily targets.
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {bankedToday > 0 ? `${bankedToday} banked today — ` : ''}
          Daily habit + safe gradual fitness, not max-test chasing.
        </p>
        <Link
          to="/settings/training"
          className={cn(
            'mt-3 flex min-h-11 w-full items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary transition-[background-color,border-color] hover:border-accent/40 hover:bg-surface/90',
          )}
        >
          Set up training plan
        </Link>
      </Card>
    )
  }

  if (variant === 'compact') {
    return (
      <Card
        padding="sm"
        data-testid="day-progress-card"
        className={cn('mt-3', className)}
      >
        <div className="flex items-center justify-between gap-2">
          {loading ? (
            <Skeleton className="h-5 w-24" />
          ) : isRestDay ? (
            <p className="font-mono text-sm font-semibold tabular-nums text-text-primary">
              {bankedToday}
              <span className="ml-1 text-xs font-medium text-text-muted">banked</span>
            </p>
          ) : (
            <p className="font-mono text-sm font-semibold tabular-nums text-text-primary">
              {bankedToday}
              <span className="text-text-muted"> / {target}</span>
              <span className="ml-1.5 text-xs font-medium text-text-muted">today</span>
            </p>
          )}

          {!loading && !isRestDay && setPlan ? (
            <Badge variant={dayTypeBadgeVariant(setPlan.dayType)} className="shrink-0 capitalize">
              {setPlan.dayTypeLabel}
            </Badge>
          ) : null}

          {!loading && isRestDay ? (
            <span className="text-xs font-medium text-text-muted">Recovery</span>
          ) : null}
        </div>

        {!isRestDay && setPlan ? (
          <>
            <GoalProgressBar
              current={bankedToday}
              target={target}
              ariaLabel="Daily push-up progress"
              className="mt-2"
              barClassName="h-1.5"
            />

            {!loading ? (
              <>
                <p className="mt-1.5 line-clamp-1 text-xs text-text-muted">
                  {setPlan.headline}
                  {!setPlan.goalHit && setPlan.currentSetNumber && setPlan.setsPlanned > 0
                    ? ` · set ${setPlan.currentSetNumber} of ${setPlan.setsPlanned}`
                    : ''}
                </p>
                {prescription?.safetyNote ? (
                  <p className="mt-1 text-xs text-text-muted">{prescription.safetyNote}</p>
                ) : null}
              </>
            ) : (
              <Skeleton className="mt-2 h-3 w-full" />
            )}
          </>
        ) : (
          <p className="mt-1.5 text-xs text-text-muted">{setPlan?.headline ?? 'Recovery day'}</p>
        )}
      </Card>
    )
  }

  return (
    <Card padding="md" className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Today</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-28" />
          ) : (
            <p className="mt-1 font-mono text-2xl font-bold leading-none text-text-primary">
              {bankedToday}
              <span className="ml-1.5 text-sm font-medium text-text-muted">banked</span>
            </p>
          )}
        </div>
        <div className="text-right">
          {isRestDay ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Rest day
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">Recovery</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Goal</p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">{target}</p>
            </>
          )}
        </div>
      </div>

      {setPlan ? (
        <div className="mt-4 space-y-3">
          {!loading && !isRestDay && prescription && prescription.sets > 0 ? (
            <div className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-text-primary">Today&apos;s plan</p>
                <Badge variant={dayTypeBadgeVariant(setPlan.dayType)} className="capitalize">
                  {setPlan.dayTypeLabel}
                </Badge>
              </div>
              <p className="mt-1.5 text-sm font-medium text-text-primary">{setPlan.headline}</p>
              {setPlan.detail ? (
                <p className="mt-1 text-xs leading-relaxed text-text-muted">{setPlan.detail}</p>
              ) : null}
            </div>
          ) : null}

          {!isRestDay ? (
            <>
              <GoalProgressBar
                current={bankedToday}
                target={target}
                ariaLabel="Daily push-up progress"
              />
              <p className="text-xs text-text-muted">
                {loading ? (
                  'Loading today…'
                ) : setPlan.goalHit ? (
                  setPlan.headline
                ) : (
                  <>
                    <span className="font-medium text-text-primary">{setPlan.remainingReps}</span>{' '}
                    reps to daily goal
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-xs text-text-muted">{setPlan.headline}</p>
          )}
        </div>
      ) : null}
    </Card>
  )
})
