import { cn } from '@/lib/cn'

export type NavItem = 'today' | 'leaderboard' | 'activity' | 'group'

export type BottomNavProps = {
  active: NavItem
  onNavigate: (item: NavItem) => void
  className?: string
}

type NavConfig = {
  id: NavItem
  label: string
  icon: (active: boolean) => JSX.Element
}

const navItems: NavConfig[] = [
  {
    id: 'today',
    label: 'Today',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.75}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path
          d="M12 7v5l3 2"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: 'leaderboard',
    label: 'Leaderboard',
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 20V10M12 20V4M16 20v-6"
        />
        <path strokeLinecap="round" d="M4 20h16" />
      </svg>
    ),
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 12h3l2-7 4 14 2-7h5"
        />
      </svg>
    ),
  },
  {
    id: 'group',
    label: 'Group',
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <circle cx="9" cy="8" r="3" />
        <circle cx="16.5" cy="9.5" r="2.5" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 18.5c.6-2.5 2.4-4 4.5-4s3.9 1.5 4.5 4M14 18.5c.4-1.8 1.6-3 3-3"
        />
      </svg>
    ),
  },
]

export function BottomNav({ active, onNavigate, className }: BottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg',
        'pb-[env(safe-area-inset-bottom)]',
        className,
      )}
      aria-label="Main navigation"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {navItems.map((item) => {
          const isActive = active === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-2',
                'text-[0.6875rem] font-medium transition-colors duration-[var(--duration-fast)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50',
                isActive ? 'text-accent' : 'text-text-muted hover:text-text-primary',
              )}
            >
              {item.icon(isActive)}
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
