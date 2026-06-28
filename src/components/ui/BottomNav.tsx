import { cn } from '@/lib/cn'

export type NavItem = 'log' | 'leaderboard' | 'activity' | 'group' | 'settings'

export type BottomNavProps = {
  active: NavItem
  onNavigate: (item: NavItem) => void
  className?: string
}

type NavConfig = {
  id: NavItem
  label: string
  hero?: boolean
  icon: () => JSX.Element
}

function LogIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  )
}

const navItems: NavConfig[] = [
  {
    id: 'leaderboard',
    label: 'Board',
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
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
    label: 'Feed',
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
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
    id: 'log',
    label: 'Log',
    hero: true,
    icon: () => <LogIcon className="h-7 w-7" />,
  },
  {
    id: 'group',
    label: 'Group',
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
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
  {
    id: 'settings',
    label: 'Settings',
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        />
      </svg>
    ),
  },
]

function NavButton({
  item,
  isActive,
  onNavigate,
}: {
  item: NavConfig
  isActive: boolean
  onNavigate: (item: NavItem) => void
}) {
  const labelClass = cn(
    'text-[0.625rem] font-medium leading-none',
    isActive
      ? item.hero
        ? 'font-semibold text-accent'
        : 'text-accent'
      : 'text-text-muted hover:text-text-primary',
  )

  if (item.hero) {
    return (
      <button
        type="button"
        onClick={() => onNavigate(item.id)}
        aria-current={isActive ? 'page' : undefined}
        aria-label="Log push-ups"
        className={cn(
          'relative flex flex-col items-center gap-1 px-0.5 pb-1 pt-2',
          'transition-transform duration-[var(--duration-fast)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset',
          'active:scale-95',
        )}
      >
        <span className="relative flex h-7 w-full items-end justify-center overflow-visible">
          <span
            className={cn(
              'absolute bottom-0 left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-2 items-center justify-center rounded-full',
              'border-2 bg-bg shadow-[0_4px_20px_rgba(255,107,74,0.35)]',
              'transition-colors duration-[var(--duration-fast)]',
              isActive
                ? 'border-accent bg-accent text-white'
                : 'border-accent text-accent hover:bg-accent/10',
            )}
          >
            {item.icon()}
          </span>
        </span>
        <span className={labelClass}>{item.label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center gap-1 px-0.5 pb-1 pt-2',
        'transition-colors duration-[var(--duration-fast)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-inset',
      )}
    >
      <span className="flex h-7 w-full items-center justify-center">{item.icon()}</span>
      <span className={labelClass}>{item.label}</span>
    </button>
  )
}

export function BottomNav({ active, onNavigate, className }: BottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 overflow-visible border-t border-border bg-bg',
        'pb-[var(--bottom-nav-safe)]',
        className,
      )}
      aria-label="Main navigation"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 overflow-visible">
        {navItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={active === item.id}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  )
}
