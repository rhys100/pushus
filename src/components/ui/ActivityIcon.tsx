import { getActivityIconShape } from '@/lib/activityIcons'
import { cn } from '@/lib/cn'

export type ActivityIconProps = {
  /** An ActivityIconId (see lib/activityIcons), or any other string (e.g. a legacy emoji) rendered as text. */
  icon: string
  className?: string
}

/** Minimal line icon for an activity; falls back to plain text for legacy emojis. */
export function ActivityIcon({ icon, className }: ActivityIconProps) {
  const shape = getActivityIconShape(icon)

  if (!shape) {
    return (
      <span className={cn('inline-block leading-none', className)} aria-hidden="true">
        {icon}
      </span>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      // 2 (not 1.75) keeps the figure pictograms legible at the 14px sizes
      // used in the switcher pill and progress chips.
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('inline-block shrink-0', className)}
    >
      {shape.paths.map((d) => (
        <path key={d} d={d} />
      ))}
      {shape.circles?.map((circle) => (
        <circle key={`${circle.cx}-${circle.cy}-${circle.r}`} {...circle} />
      ))}
    </svg>
  )
}
