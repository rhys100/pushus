import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

export type BackLinkProps = {
  /** Route to return to (the page's logical parent). */
  to: string
  /** Short label after the arrow, e.g. "Group" or "Challenges". */
  label: string
  className?: string
}

/**
 * Header back affordance for full-screen sub-pages rendered with
 * `showNav={false}`. Those pages have no bottom nav, so without an explicit back
 * control a user can be stranded — most acutely in a standalone iOS PWA, which
 * has no system back button. Pass to `AppLayout`'s `headerLeading`.
 */
export function BackLink({ to, label, className }: BackLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        '-ml-1 inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1 py-1 text-sm font-medium',
        'text-text-muted transition-colors hover:text-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        className,
      )}
    >
      <span aria-hidden="true" className="text-base leading-none">
        ←
      </span>
      {label}
    </Link>
  )
}
