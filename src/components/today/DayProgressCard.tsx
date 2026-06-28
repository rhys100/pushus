import { memo } from 'react'
import { Card } from '@/components/ui/Card'
import { GoalProgressBar } from '@/components/ui/GoalProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import type { TodayPrescription } from '@/lib/training/planEngine'
import { getDefaultPlan, getTodayPrescription } from '@/lib/training/planEngine'

export type DayProgressCardProps = {
  bankedToday: number
  loading?: boolean
  dailyTarget?: number
  todayPrescription?: TodayPrescription
  className?: string
}

export const DayProgressCard = memo(function DayProgressCard({
  bankedToday,
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
  const goalHit = !isRestDay && bankedToday >= target
  const remaining = Math.max(target - bankedToday, 0)

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

      {!isRestDay ? (
        <div className="mt-4">
          {prescription.sets > 0 ? (
            <p className="mb-2 text-xs text-text-muted">
              {prescription.sets} sets of {prescription.setSize} — spread through the day
            </p>
          ) : null}

          <GoalProgressBar
            current={bankedToday}
            target={target}
            ariaLabel="Daily push-up progress"
          />

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
      ) : (
        <p className="mt-4 text-xs text-text-muted">
          Rest day — optional light work only. Logging still counts toward your streak.
        </p>
      )}
    </Card>
  )
})
