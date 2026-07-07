import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export type GoalProgressBarProps = {
  current: number
  target: number
  isRestDay?: boolean
  showLabel?: boolean
  inline?: boolean
  className?: string
  ariaLabel?: string
  barClassName?: string
}

function ProgressTrack({
  current,
  target,
  className,
  barClassName,
  ariaLabel,
}: {
  current: number
  target: number
  className?: string
  barClassName?: string
  ariaLabel: string
}) {
  const progress = Math.min(current / target, 1)
  const goalHit = current >= target

  // Flash the bar once at the moment the goal is crossed (not on a page
  // that loads with the goal already hit).
  const prevGoalHit = useRef(goalHit)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const crossed = goalHit && !prevGoalHit.current
    prevGoalHit.current = goalHit

    if (!crossed) {
      return
    }

    setFlash(true)
    const timer = window.setTimeout(() => setFlash(false), 750)
    return () => window.clearTimeout(timer)
  }, [goalHit])

  return (
    <div
      className={cn(
        'h-2.5 w-full min-w-0 overflow-hidden rounded-[var(--radius-full)] bg-text-muted/25 ring-1 ring-inset ring-text-muted/40',
        className,
        barClassName,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={current}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'relative h-full overflow-hidden rounded-[var(--radius-full)] transition-[width,background-color] duration-[var(--duration-slower)] ease-[var(--ease-out)]',
          goalHit ? 'bg-success' : 'bg-accent',
          flash && 'goal-flash',
        )}
        style={{ width: `${Math.max(progress * 100, current > 0 ? 4 : 0)}%` }}
      >
        {current > 0 && !goalHit ? (
          <span className="bar-sheen absolute inset-y-0 w-8" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  )
}

export function GoalProgressBar({
  current,
  target,
  isRestDay = false,
  showLabel = false,
  inline = false,
  className,
  barClassName,
  ariaLabel = 'Daily push-up progress',
}: GoalProgressBarProps) {
  if (inline) {
    if (isRestDay || target === 0) {
      return null
    }

    return (
      <ProgressTrack
        current={current}
        target={target}
        className={className}
        barClassName={barClassName}
        ariaLabel={ariaLabel}
      />
    )
  }

  if (isRestDay || target === 0) {
    return (
      <p className={cn('text-xs text-text-muted', className)}>Rest day</p>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {showLabel ? (
        <div className="flex items-center justify-end">
          <p className="font-mono text-xs tabular-nums text-text-muted">
            <span className="font-semibold text-text-primary">{current}</span>/{target}
          </p>
        </div>
      ) : null}

      <ProgressTrack
        current={current}
        target={target}
        className="h-2.5 w-full"
        barClassName={barClassName}
        ariaLabel={ariaLabel}
      />
    </div>
  )
}

export function GoalProgressFraction({
  current,
  target,
  isRestDay = false,
  className,
}: {
  current: number
  target: number
  isRestDay?: boolean
  className?: string
}) {
  if (isRestDay || target === 0) {
    return (
      <span className={cn('text-xs font-medium text-text-muted', className)}>Rest</span>
    )
  }

  return (
    <span className={cn('font-mono text-sm font-semibold tabular-nums', className)}>
      {/* Keyed by value so the tick replays whenever the number moves */}
      <span key={current} className="value-tick text-text-primary">
        {current}
      </span>
      <span className="text-text-muted">/{target}</span>
    </span>
  )
}
