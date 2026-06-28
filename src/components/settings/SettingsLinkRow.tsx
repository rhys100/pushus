import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type SettingsLinkRowProps = {
  to: string
  title: string
  description?: string
  className?: string
}

export function SettingsLinkRow({ to, title, description, className }: SettingsLinkRowProps) {
  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] px-1 py-2',
        'text-sm text-text-primary hover:text-accent',
        className,
      )}
    >
      <span>
        <span className="block font-medium">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-text-muted">{description}</span>
        ) : null}
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  )
}
