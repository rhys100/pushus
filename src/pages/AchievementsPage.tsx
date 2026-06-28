import { AppLayout } from '@/components/layout/AppLayout'
import { Badge, Card, EmptyState, Skeleton, StatCard } from '@/components/ui'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  useAchievementCatalog,
  useUserAchievements,
  useXpTotal,
} from '@/hooks/useGamification'
import { useAuth } from '@/providers/AuthProvider'

export function AchievementsPage() {
  const { user } = useAuth()
  const { activeGroup, loading: groupLoading } = useActiveGroup()
  const { data: catalog = [], isLoading: catalogLoading } = useAchievementCatalog()
  const { data: unlocked = [], isLoading: unlockedLoading } = useUserAchievements(
    activeGroup,
    user?.id,
  )
  const { data: xpTotal = 0, isLoading: xpLoading } = useXpTotal(activeGroup, user?.id)

  const unlockedIds = new Set(unlocked.map((item) => item.achievement_id))
  const loading = groupLoading || catalogLoading || unlockedLoading || xpLoading

  return (
    <AppLayout title="Achievements" subtitle={activeGroup?.name} showNav={false}>
      <div className="space-y-6 pb-8">
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <StatCard label="Total XP" value={xpTotal.toLocaleString()} hint="1 XP per push-up banked" />
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Badge catalog
          </h2>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : catalog.length === 0 ? (
            <EmptyState
              title="No badges configured"
              description="Achievement catalog loads from the database after migration."
            />
          ) : (
            <ul className="space-y-2">
              {catalog.map((achievement) => {
                const isUnlocked = unlockedIds.has(achievement.id)

                return (
                  <li key={achievement.id}>
                    <Card
                      padding="md"
                      className={`flex items-start gap-3 ${isUnlocked ? '' : 'opacity-60'}`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg text-xl">
                        {achievement.icon_emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-text-primary">{achievement.name}</p>
                          {isUnlocked ? <Badge variant="success">Unlocked</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-text-muted">{achievement.description}</p>
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {unlocked.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Your unlocks
            </h2>
            <ul className="space-y-2">
              {unlocked.map((item) => (
                <li key={item.id}>
                  <Card padding="sm" className="flex items-center gap-3">
                    <span className="text-xl">{item.achievements?.icon_emoji ?? '🏅'}</span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {item.achievements?.name ?? 'Achievement'}
                      </p>
                      <p className="text-xs text-text-muted">
                        {new Date(item.unlocked_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AppLayout>
  )
}
