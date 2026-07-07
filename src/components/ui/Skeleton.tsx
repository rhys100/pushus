import { cn } from '@/lib/cn'

export type SkeletonProps = {
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

const roundedStyles = {
  sm: 'rounded-[var(--radius-sm)]',
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
  full: 'rounded-[var(--radius-full)]',
} as const

export function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton-sweep bg-border/70',
        roundedStyles[rounded],
        className,
      )}
    />
  )
}
