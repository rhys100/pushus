import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppHeader, BottomNav, type NavItem } from '@/components/ui'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { cn } from '@/lib/cn'
import { resolveAppLayoutDocumentTitle } from '@/lib/documentTitle'

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
  headerLeading?: React.ReactNode
  headerTrailing?: React.ReactNode
  onNavigate?: (item: NavItem) => void
  children?: React.ReactNode
}

const TOAST_TOP_WITH_HEADER = 'calc(env(safe-area-inset-top, 0px) + 4.25rem)'
const TOAST_TOP_HEADERLESS = 'calc(env(safe-area-inset-top, 0px) + 0.75rem)'

export function AppLayout({
  title,
  subtitle,
  showNav = true,
  headerLeading,
  headerTrailing,
  onNavigate,
  children,
}: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeGroup } = useActiveGroup()

  const activeNav = navItemFromPath(location.pathname)
  const isTodayRoute = location.pathname.startsWith('/today')
  const resolvedTitle = title ?? activeGroup?.name ?? 'PushUS'
  const resolvedSubtitle =
    subtitle ?? (activeGroup ? 'Your push-up crew' : undefined)
  const documentTitle = resolveAppLayoutDocumentTitle(
    title,
    activeGroup?.name,
    isTodayRoute,
  )

  useDocumentTitle(documentTitle)

  useEffect(() => {
    const toastTop = title === null ? TOAST_TOP_HEADERLESS : TOAST_TOP_WITH_HEADER
    document.documentElement.style.setProperty('--toast-top', toastTop)
    return () => {
      document.documentElement.style.removeProperty('--toast-top')
    }
  }, [title])

  const handleNavigate = onNavigate ?? ((item: NavItem) => navigate(navRoutes[item]))

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
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
          showNav
            ? 'pb-[calc(var(--bottom-nav-height)+var(--bottom-dock-prompt-reserve,0px)+0.5rem)]'
            : 'pb-[calc(2rem+max(3rem,env(safe-area-inset-bottom,0px)))]',
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
