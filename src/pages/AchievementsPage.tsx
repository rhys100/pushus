import { AppLayout } from '@/components/layout/AppLayout'
import { BackLink, Badge, Button, Card, EmptyState, Skeleton, StatCard, useToast } from '@/components/ui'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  useAchievementCatalog,
  useUserAchievements,
  useXpTotal,
} from '@/hooks/useGamification'
import { useGoalStreak, useStreakStatus, useUseStreakFreeze } from '@/hooks/useStreaks'
import { useMyCustomBadges } from '@/hooks/useCustomBadges'
import { useAuth } from '@/providers/AuthProvider'

/** Streak days that earn a celebration pulse when you visit on the day. */
function isStreakMilestone(days: number): boolean {
  if (days >= 100) return days % 50 === 0
  return [7, 14, 21, 30, 50, 75].includes(days)
}

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
  const { data: goalStreak = 0 } = useGoalStreak(activeGroup)
  const { data: banterBadges = [] } = useMyCustomBadges(activeGroup?.id, user?.id)
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
    <AppLayout
      title="Achievements"
      subtitle={activeGroup?.name}
      showNav={false}
      headerLeading={<BackLink to="/group" label="Group" />}
    >
      <div className="space-y-6 pb-8">
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <StatCard label="Total XP" value={xpTotal} hint="1 XP per push-up banked" />
          )}
          {streakLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <StatCard
              label="Active streak"
              className={
                streak && streak.todayLogged && isStreakMilestone(streak.activeStreak)
                  ? 'goal-celebrate'
                  : undefined
              }
              value={
                <>
                  {streak?.activeStreak ?? 0}
                  {/* Flame flickers only while today's bank is still owed */}
                  <span
                    className={streak && !streak.todayLogged ? 'flame-flicker' : undefined}
                    aria-hidden="true"
                  >
                    🔥
                  </span>
                </>
              }
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
            {goalStreak >= 1 ? (
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">🎯 Goal streak</p>
                  <p className="text-xs text-text-muted">
                    Days in a row you hit your daily goal.
                  </p>
                </div>
                <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-text-primary">
                  {goalStreak} day{goalStreak === 1 ? '' : 's'}
                </span>
              </div>
            ) : null}
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
            <ul className="motion-stagger space-y-2">
              {catalog.map((achievement) => {
                const isUnlocked = unlockedIds.has(achievement.id)
                // Lifetime clubs can show live progress: total XP is exactly
                // lifetime effective reps (1 rep = 1 XP, no bonuses yet).
                const lifetimeTarget =
                  !isUnlocked && achievement.criteria?.type === 'lifetime_total'
                    ? Number(achievement.criteria.value)
                    : null
                const progress =
                  lifetimeTarget && lifetimeTarget > 0
                    ? Math.min(xpTotal / lifetimeTarget, 1)
                    : null

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
                        {progress !== null && lifetimeTarget ? (
                          <div className="mt-2 space-y-1">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-text-muted/20">
                              <div
                                className="h-full rounded-full bg-accent/70"
                                style={{ width: `${Math.round(progress * 100)}%` }}
                              />
                            </div>
                            <p className="font-mono text-[0.65rem] tabular-nums text-text-muted">
                              {xpTotal.toLocaleString()} / {lifetimeTarget.toLocaleString()}
                            </p>
                          </div>
                        ) : null}
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
            <ul className="motion-stagger space-y-2">
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

        {banterBadges.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Group badges
            </h2>
            <ul className="motion-stagger space-y-2">
              {banterBadges.map((item) => (
                <li key={item.id}>
                  <Card padding="sm" className="flex items-center gap-3">
                    <span className="text-xl">{item.custom_badges?.icon_emoji ?? '🎖️'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {item.custom_badges?.name ?? 'Badge'}
                      </p>
                      <p className="text-xs text-text-muted">
                        {item.note ? item.note : 'Awarded by your group admin'}
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
