import { useCallback, useRef, useState } from 'react'
import { useLoggerDragHint } from '@/hooks/useLoggerDragHint'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  useBankPushups,
  useDayTotal,
  useTodayEntries,
  useUndoLastEntry,
} from '@/hooks/useTodayData'
import { useGroupBillingStatus, useGroupSubscription } from '@/hooks/useBilling'
import { BillingBanner } from '@/components/billing/BillingBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { billingConfig } from '@/lib/billing'
import {
  CircularLogger,
  type CircularLoggerHandle,
} from '@/components/logger/CircularLogger'
import { BankPushupsButton } from '@/components/logger/BankPushupsButton'
import { DayProgressCard } from '@/components/today/DayProgressCard'
import { TodayEntriesList } from '@/components/today/TodayEntriesList'
import { useAuth } from '@/providers/AuthProvider'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'

export function TodayPage() {
  const { toast } = useToast()
  const { user, profile } = useAuth()
  const { activeGroup, loading: groupLoading, role } = useActiveGroup()
  const { dailyTarget, loading: planLoading } = useTrainingPlan(user?.id, activeGroup?.id)
  const { showHint, dismissHint } = useLoggerDragHint()
  const billingStatusQuery = useGroupBillingStatus(activeGroup?.id)
  const subscriptionQuery = useGroupSubscription(activeGroup?.id)
  const { data: dayTotal = 0, isLoading: totalLoading } = useDayTotal(activeGroup)
  const { data: entries = [], isLoading: entriesLoading } = useTodayEntries(
    activeGroup,
    user?.id,
  )

  const bankPushups = useBankPushups()
  const undoLastEntry = useUndoLastEntry()
  const loggerRef = useRef<CircularLoggerHandle>(null)
  const [canBank, setCanBank] = useState(false)
  const [dragCount, setDragCount] = useState(0)

  const handleBank = useCallback(async () => {
    if (!activeGroup || !canBank || bankPushups.isPending || !user || !profile) {
      return
    }

    const bankedCount = loggerRef.current?.getCount() ?? 0

    if (bankedCount <= 0) {
      return
    }

    try {
      await bankPushups.mutateAsync({
        group: activeGroup,
        count: bankedCount,
        userId: user.id,
        profile: {
          user_id: user.id,
          display_name: profile.display_name,
          avatar_emoji: profile.avatar_emoji,
          avatar_color: profile.avatar_color,
        },
      })
      loggerRef.current?.reset()
      setDragCount(0)
      dismissHint()

      toast({
        message: `${bankedCount} push-ups banked.`,
        variant: 'success',
        durationMs: 6000,
        actionLabel: 'Undo',
        onAction: () => {
          undoLastEntry.mutate(
            { group: activeGroup, userId: user.id },
            {
              onSuccess: () => {
                toast({
                  message: 'Last entry undone.',
                  variant: 'default',
                  durationMs: 4000,
                })
              },
              onError: () => {
                toast({
                  message: 'Could not undo. Try again.',
                  variant: 'danger',
                  durationMs: 5000,
                })
              },
            },
          )
        },
      })
    } catch {
      toast({
        message: 'Could not bank push-ups. Try again.',
        variant: 'danger',
        durationMs: 5000,
      })
    }
  }, [
    activeGroup,
    bankPushups,
    canBank,
    dismissHint,
    profile,
    toast,
    undoLastEntry,
    user,
  ])

  if (groupLoading || !activeGroup) {
    return (
      <div className="space-y-4">
        <DayProgressCard bankedToday={0} loading />
        <Skeleton className="mx-auto h-[min(72vw,280px)] w-[min(72vw,280px)] rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {billingConfig.enabled ? (
        <BillingBanner
          className="mb-4"
          billingStatus={billingStatusQuery.data ?? activeGroup.billing_status}
          subscription={subscriptionQuery.data}
          isOwner={role === 'owner'}
        />
      ) : null}

      <DayProgressCard
        bankedToday={dayTotal}
        loading={(totalLoading && dayTotal === 0) || planLoading}
        dailyTarget={dailyTarget}
      />

      <CircularLogger
        ref={loggerRef}
        onCountChange={setDragCount}
        onCanBankChange={setCanBank}
        onBank={handleBank}
        disabled={bankPushups.isPending}
        showDragHint={showHint}
        onHintDismiss={dismissHint}
        className="mt-1"
      />

      <TodayEntriesList
        group={activeGroup}
        entries={entries}
        loading={entriesLoading && entries.length === 0}
      />

      <BankPushupsButton
        disabled={!canBank}
        loading={bankPushups.isPending}
        showDisabledHint={dragCount === 0}
        onBank={handleBank}
      />
    </div>
  )
}

export default TodayPage
