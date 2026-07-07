import { AppLayout } from '@/components/layout/AppLayout'
import { Badge, Button, Card, EmptyState, Skeleton, StatCard, useToast } from '@/components/ui'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  useAchievementCatalog,
  useUserAchievements,
  useXpTotal,
} from '@/hooks/useGamification'
import { useStreakStatus, useUseStreakFreeze } from '@/hooks/useStreaks'
import { useAuth } from '@/providers/AuthProvider'

export function AchievementsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { activeGroup, loading: groupLoading } = useActiveGroup()
  const { data: catalog = [], isLoading: catalogLoading } = useAchievementCatalog()
  const { data: unlocked = [], isLoading: unlockedLoading } = useUserAchievements(
    activeGroup,
    user?.id,
  )
  const { data: xpTotal = 0, isLoading: xpLoading } = useXpTotal(activeGroup, user?.id)
  const { data: streak, isLoading: streakLoading } = useStreakStatus(activeGroup, user?.id)
  const useFreeze = useUseStreakFreeze(activeGroup, user?.id)

  const unlockedIds = new Set(unlocked.map((item) => item.achievement_id))
  const loading = groupLoading || catalogLoading || unlockedLoading || xpLoading

  async function handleUseFreeze() {
    if (!streak?.freeze.protectableDate) {
      return
    }

    try {
      await useFreeze.mutateAsync(streak.freeze.protectableDate)
      toast({ message: 'Streak freeze used — yesterday is protected.', variant: 'success' })
    } catch {
      toast({ message: 'Could not use the freeze. Try again.', variant: 'danger' })
    }
  }

  return (
    <AppLayout title="Achievements" subtitle={activeGroup?.name} showNav={false}>
      <div className="space-y-6 pb-8">
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <StatCard label="Total XP" value={xpTotal.toLocaleString()} hint="1 XP per push-up banked" />
          )}
          {streakLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <StatCard
              label="Active streak"
              value={`${streak?.activeStreak ?? 0}🔥`}
              hint={
                streak?.todayLogged
                  ? 'Today is banked'
                  : 'Bank today to keep it going'
              }
            />
          )}
        </div>

        {streak && !streakLoading ? (
          <Card padding="md" className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">Streak freeze</p>
                <p className="text-xs text-text-muted">
                  {streak.freeze.usedThisWeek
                    ? 'Used this week — resets Monday.'
                    : 'One per week. Protects a missed day without faking reps.'}
                </p>
              </div>
              {streak.freeze.protectableDate ? (
                <Button
                  variant="secondary"
                  className="min-h-9 shrink-0 px-3 text-sm"
                  loading={useFreeze.isPending}
                  onClick={() => void handleUseFreeze()}
                >
                  Protect yesterday
                </Button>
              ) : (
                <Badge variant={streak.freeze.usedThisWeek ? 'neutral' : 'success'}>
                  {streak.freeze.usedThisWeek ? 'Used' : 'Available'}
                </Badge>
              )}
            </div>
          </Card>
        ) : null}

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
