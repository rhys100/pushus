import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { GoalProgressBar } from '@/components/ui/GoalProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/cn'
import { successHaptic } from '@/lib/haptics'
import { computeDailySetPlan } from '@/lib/training/dailySetPlan'
import { dayTypeBadgeVariant, type TodayPrescription } from '@/lib/training/planEngine'

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

  const bankedDisplay = useCountUp(bankedToday)

  // Celebrate the moment the daily goal is crossed — but only a live crossing
  // between two settled states, never the jump when query data hydrates in.
  const [celebrate, setCelebrate] = useState(false)
  const prevGoalState = useRef({ banked: bankedToday, loading })

  useEffect(() => {
    const prev = prevGoalState.current
    prevGoalState.current = { banked: bankedToday, loading }

    const crossed =
      !loading &&
      !prev.loading &&
      !isRestDay &&
      target > 0 &&
      prev.banked < target &&
      bankedToday >= target

    if (!crossed) {
      return
    }

    successHaptic()
    setCelebrate(true)
    const timer = window.setTimeout(() => setCelebrate(false), 700)
    return () => window.clearTimeout(timer)
  }, [bankedToday, loading, isRestDay, target])

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
          {bankedToday > 0
            ? `${bankedToday} banked today — daily habit + safe gradual fitness, not max-test chasing.`
            : 'Daily habit + safe gradual fitness, not max-test chasing.'}
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
    const statValueClass = 'text-lg font-bold tabular-nums text-accent'
    const statLabelClass =
      'mt-0.5 text-3xs font-medium uppercase tracking-wide text-text-muted'

    return (
      <Card
        data-testid="day-progress-card"
        className={cn('mt-3', celebrate && 'goal-celebrate', className)}
      >
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="mx-auto h-5 w-44" />
            <Skeleton className="h-2.5 w-full" rounded="full" />
            <Skeleton className="mx-auto h-3 w-28" />
          </div>
        ) : isRestDay ? (
          <div className="text-center">
            <p className={statValueClass}>Recovery</p>
            <p className={statLabelClass}>
              {bankedToday > 0 ? `${bankedToday} banked · no target today` : 'No target today'}
            </p>
          </div>
        ) : setPlan?.goalHit ? (
          <div className="text-center">
            <p className={statValueClass}>Goal hit</p>
            <p className={statLabelClass}>
              {bankedToday}/{target} · {banksLogged} set{banksLogged === 1 ? '' : 's'} banked
            </p>
          </div>
        ) : setPlan ? (
          // Lead with the plain-language plan headline (e.g. "Bank about 5 — set
          // 2 of 3") + a progress bar. The old three orange columns ("~5 / BANK
          // NEXT") read as a riddle.
          <div className="space-y-2">
            <p className="text-center text-sm font-semibold text-text-primary">
              {setPlan.headline}
            </p>
            <GoalProgressBar
              current={bankedToday}
              target={target}
              ariaLabel="Daily push-up progress"
            />
            <p className="text-center text-xs text-text-muted">
              <span className="font-medium tabular-nums text-text-primary">
                {bankedToday} of {target}
              </span>{' '}
              today · {prescription?.safetyNote ?? `${setPlan.dayTypeLabel} day`}
            </p>
          </div>
        ) : null}
      </Card>
    )
  }

  return (
    <Card padding="md" className={cn(celebrate && 'goal-celebrate', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Today</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-28" />
          ) : (
            <p className="mt-1 font-mono text-2xl font-bold leading-none text-text-primary">
              {bankedDisplay}
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
              {loading ? (
                // Skeleton instead of a live bar: mounting at 0 and then
                // hydrating to a full bar would false-fire the goal flash.
                <Skeleton className="h-2.5 w-full" rounded="full" />
              ) : (
                <GoalProgressBar
                  current={bankedToday}
                  target={target}
                  ariaLabel="Daily push-up progress"
                />
              )}
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
