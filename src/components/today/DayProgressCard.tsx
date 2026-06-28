import { memo, useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { GoalProgressBar } from '@/components/ui/GoalProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { computeDailySetPlan } from '@/lib/training/dailySetPlan'
import type { TodayPrescription } from '@/lib/training/planEngine'
import { getDefaultPlan, getTodayPrescription } from '@/lib/training/planEngine'

export type DayProgressCardProps = {
  bankedToday: number
  banksLogged?: number
  loading?: boolean
  dailyTarget?: number
  todayPrescription?: TodayPrescription
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
  dailyTarget,
  todayPrescription,
  className,
}: DayProgressCardProps) {
  const defaultPlan = getDefaultPlan()
  const prescription =
    todayPrescription ??
    getTodayPrescription(defaultPlan, new Date().toISOString().slice(0, 10))

  const target = dailyTarget ?? prescription.target
  const isRestDay = prescription.isRestDay || target === 0

  const setPlan = useMemo(
    () =>
      computeDailySetPlan(
        {
          dayType: prescription.dayType,
          target,
          setSize: prescription.setSize,
          sets: prescription.sets,
          isRestDay,
        },
        bankedToday,
        banksLogged,
      ),
    [prescription, target, isRestDay, bankedToday, banksLogged],
  )

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
          {isRestDay ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Rest day
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">Recovery</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Goal
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {target}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {!loading && !isRestDay && prescription.sets > 0 ? (
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
    </Card>
  )
})
