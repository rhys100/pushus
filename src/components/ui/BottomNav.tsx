import { cn } from '@/lib/cn'
import { tapHaptic } from '@/lib/haptics'

export type NavItem = 'log' | 'leaderboard' | 'activity' | 'group' | 'settings'

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
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={cn('h-5 w-5', active && 'text-accent')}
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
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={cn('h-5 w-5', active && 'text-accent')}
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
    icon: (active) => (
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-[var(--duration-fast)]',
          active
            ? 'bg-accent text-white shadow-[0_0_12px_rgba(255,107,74,0.35)]'
            : 'border-2 border-accent/80 text-accent',
        )}
      >
        <LogIcon className="h-5 w-5" />
      </span>
    ),
  },
  {
    id: 'group',
    label: 'Group',
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={cn('h-5 w-5', active && 'text-accent')}
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
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={cn('h-5 w-5', active && 'text-accent')}
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

export function BottomNav({ active, onNavigate, className }: BottomNavProps) {
  return (
    <nav
      className={cn('fixed inset-x-0 bottom-0 z-40', className)}
      aria-label="Main navigation"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel pb-[var(--bottom-nav-safe)]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {navItems.map((item) => {
            const isActive = active === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    tapHaptic()
                  }
                  onNavigate(item.id)
                }}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.id === 'log' ? 'Log push-ups' : item.label}
                className={cn(
                  'flex min-h-[var(--bottom-nav-content)] flex-col items-center justify-center gap-0.5 px-1 py-1.5',
                  'transition-colors duration-[var(--duration-fast)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50',
                  'active:scale-[0.97]',
                  isActive ? 'text-accent' : 'text-text-muted hover:text-text-primary',
                )}
              >
                <span className={cn('flex items-center justify-center', isActive && 'nav-pop')}>
                  {item.icon(isActive)}
                </span>
                <span
                  className={cn(
                    'dock-label text-[0.625rem] font-medium leading-none',
                    isActive && 'font-semibold',
                  )}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
