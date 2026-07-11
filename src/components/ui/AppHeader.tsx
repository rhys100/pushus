import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type AppHeaderProps = {
  title: string
  subtitle?: string
  leading?: ReactNode
  trailing?: ReactNode
  className?: string
}

export function AppHeader({
  title,
  subtitle,
  leading,
  trailing,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'border-b border-border/80 bg-bg',
        'pt-[env(safe-area-inset-top)]',
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}

        {/* Keyed by title so tab switches crossfade instead of snapping */}
        <div key={title} className="motion-fade min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-text-primary">{title}</h1>
          {subtitle ? (
            <p className="truncate text-xs text-text-muted">{subtitle}</p>
          ) : null}
        </div>

        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </header>
  )
}
