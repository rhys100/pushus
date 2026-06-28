import { Suspense, useCallback, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { TabPageMetaProvider, useTabPageMetaContext } from '@/components/layout/TabPageMeta'
import { Skeleton } from '@/components/ui/Skeleton'
import type { NavItem } from '@/components/ui/BottomNav'

const navRoutes: Record<NavItem, string> = {
  today: '/today',
  leaderboard: '/leaderboard',
  activity: '/activity',
  group: '/group',
}

const tabChunkPrefetches: Partial<Record<NavItem, () => Promise<unknown>>> = {
  leaderboard: () => import('@/pages/LeaderboardPage'),
  activity: () => import('@/pages/ActivityPage'),
  group: () => import('@/pages/GroupPage'),
}

function TabPageLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-[var(--radius-lg)]" />
      <Skeleton className="mx-auto h-[min(72vw,280px)] w-[min(72vw,280px)] rounded-full" />
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
  }, [])

  return (
    <AppLayout
      title={meta.title}
      subtitle={meta.subtitle}
      headerTrailing={meta.headerTrailing}
      bottomChrome={isToday ? 'today' : 'nav'}
      onNavigate={handleNavigate}
    >
      <Suspense fallback={<TabPageLoader />}>
        <Outlet />
      </Suspense>
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
