import { cn } from '@/lib/cn'

export type GoalProgressBarProps = {
  current: number
  target: number
  isRestDay?: boolean
  showLabel?: boolean
  className?: string
  ariaLabel?: string
}

export function GoalProgressBar({
  current,
  target,
  isRestDay = false,
  showLabel = false,
  className,
  ariaLabel = 'Daily push-up progress',
}: GoalProgressBarProps) {
  if (isRestDay || target === 0) {
    return (
      <p className={cn('text-[0.6875rem] text-text-muted', className)}>Rest day</p>
    )
  }

  const progress = Math.min(current / target, 1)
  const goalHit = current >= target

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <div
          className="h-2 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-full)] bg-border/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={current}
          aria-label={ariaLabel}
        >
          <div
            className={cn(
              'h-full rounded-[var(--radius-full)] transition-[width] duration-[var(--duration-normal)] ease-[var(--ease-out)]',
              goalHit ? 'bg-success' : 'bg-accent',
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {showLabel ? (
          <p className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-text-muted">
            {current}/{target}
          </p>
        ) : null}
      </div>
    </div>
  )
}
