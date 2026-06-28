import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-10 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-surface text-accent">
          {icon}
        </div>
      ) : null}

      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>

      {description ? (
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-muted">{description}</p>
      ) : null}

      {actionLabel && onAction ? (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
