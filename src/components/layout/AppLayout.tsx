import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { AppHeader, BottomNav, type NavItem } from '@/components/ui'
import { PrivateBetaBanner } from '@/components/layout/PrivateBetaBanner'
import { cn } from '@/lib/cn'
import { TODAY_BOTTOM_CHROME } from '@/lib/layout'
import { useActiveGroup } from '@/hooks/useActiveGroup'

const navRoutes: Record<NavItem, string> = {
  log: '/today',
  leaderboard: '/leaderboard',
  activity: '/activity',
  group: '/group',
  settings: '/settings',
}

function navItemFromPath(pathname: string): NavItem | null {
  if (pathname.startsWith('/today')) return 'log'
  if (pathname.startsWith('/leaderboard')) return 'leaderboard'
  if (pathname.startsWith('/activity')) return 'activity'
  if (pathname.startsWith('/group')) return 'group'
  if (pathname.startsWith('/settings')) return 'settings'
  return null
}

type AppLayoutProps = {
  title?: string | null
  subtitle?: string
  showNav?: boolean
  bottomChrome?: 'nav' | 'today'
  headerLeading?: React.ReactNode
  headerTrailing?: React.ReactNode
  onNavigate?: (item: NavItem) => void
  children?: React.ReactNode
}

export function AppLayout({
  title,
  subtitle,
  showNav = true,
  bottomChrome = 'nav',
  headerLeading,
  headerTrailing,
  onNavigate,
  children,
}: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeGroup } = useActiveGroup()

  const activeNav = navItemFromPath(location.pathname)
  const resolvedTitle = title ?? activeGroup?.name ?? 'PushUS'
  const resolvedSubtitle =
    subtitle ?? (activeGroup ? 'Your push-up crew' : undefined)

  const handleNavigate = onNavigate ?? ((item: NavItem) => navigate(navRoutes[item]))

  return (
    <div
      className="flex min-h-screen flex-col bg-bg"
      style={
        bottomChrome === 'today'
          ? ({
              '--bank-hint-block': 'var(--bank-disabled-hint-height)',
              '--today-bottom-chrome': TODAY_BOTTOM_CHROME,
              '--toast-bottom': 'calc(var(--today-bottom-chrome) + 0.5rem)',
            } as CSSProperties)
          : undefined
      }
    >
      <PrivateBetaBanner />
      {title !== null ? (
        <AppHeader
          title={resolvedTitle}
          subtitle={resolvedSubtitle}
          leading={headerLeading}
          trailing={headerTrailing}
        />
      ) : null}

      <main
        className={cn(
          'mx-auto w-full max-w-lg flex-1 px-4',
          showNav && bottomChrome === 'today'
            ? 'pb-[calc(var(--today-bottom-chrome)+0.5rem)] md:pb-[calc(4.5rem+env(safe-area-inset-bottom))]'
            : showNav
              ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'
              : 'pb-[calc(2rem+env(safe-area-inset-bottom))]',
          title !== null ? 'pt-4' : 'pt-[env(safe-area-inset-top)]',
        )}
      >
        {children ?? <Outlet />}
      </main>

      {showNav && activeNav ? (
        <BottomNav
          active={activeNav}
          onNavigate={handleNavigate}
        />
      ) : null}
    </div>
  )
}
