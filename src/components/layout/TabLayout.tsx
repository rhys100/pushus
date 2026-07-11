import { Suspense, useCallback, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { TabPageMetaProvider, useTabPageMetaContext } from '@/components/layout/TabPageMeta'
import { WhatsNewPopup } from '@/components/WhatsNewPopup'
import { Skeleton } from '@/components/ui/Skeleton'
import type { NavItem } from '@/components/ui/BottomNav'

const navRoutes: Record<NavItem, string> = {
  log: '/today',
  leaderboard: '/leaderboard',
  activity: '/activity',
  group: '/group',
  settings: '/settings',
}

const tabChunkPrefetches: Partial<Record<NavItem, () => Promise<unknown>>> = {
  leaderboard: () => import('@/pages/LeaderboardPage'),
  activity: () => import('@/pages/ActivityPage'),
  group: () => import('@/pages/GroupPage'),
  settings: () => import('@/pages/SettingsPage'),
}

function TabPageLoader() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="mx-auto h-[min(72vw,336px)] w-[min(72vw,336px)] rounded-full" />
      <Skeleton className="h-16 w-full rounded-[var(--radius-lg)]" />
    </div>
  )
}

function TabLayoutShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { meta } = useTabPageMetaContext()
  const isToday = location.pathname.startsWith('/today')

  const handleNavigate = useCallback(
    (item: NavItem) => {
      const prefetch = tabChunkPrefetches[item]
      if (prefetch) {
        void prefetch()
      }
      navigate(navRoutes[item])
    },
    [navigate],
  )

  useEffect(() => {
    void import('@/pages/LeaderboardPage')
    void import('@/pages/ActivityPage')
    void import('@/pages/GroupPage')
    void import('@/pages/SettingsPage')
  }, [])

  return (
    <AppLayout
      title={isToday ? null : meta.title}
      subtitle={isToday ? undefined : meta.subtitle}
      headerTrailing={meta.headerTrailing}
      onNavigate={handleNavigate}
    >
      <Suspense fallback={<TabPageLoader />}>
        <Outlet />
      </Suspense>
      <WhatsNewPopup />
    </AppLayout>
  )
}

export function TabLayout() {
  return (
    <TabPageMetaProvider>
      <TabLayoutShell />
    </TabPageMetaProvider>
  )
}
