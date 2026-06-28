import { cn } from '@/lib/cn'

export type AvatarChipProps = {
  emoji: string
  name: string
  subtitle?: string
  active?: boolean
  className?: string
  onClick?: () => void
}

export function AvatarChip({
  emoji,
  name,
  subtitle,
  active = false,
  className,
  onClick,
}: AvatarChipProps) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-[var(--radius-full)]',
        'border px-3 py-1.5 text-left transition-colors duration-[var(--duration-fast)]',
        active
          ? 'border-accent/40 bg-accent-muted text-text-primary'
          : 'border-border bg-surface text-text-primary',
        onClick &&
          'cursor-pointer hover:border-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        className,
      )}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-lg leading-none"
        aria-hidden="true"
      >
        {emoji}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{name}</span>
        {subtitle ? (
          <span className="block truncate text-xs text-text-muted">{subtitle}</span>
        ) : null}
      </span>
    </Tag>
  )
}
