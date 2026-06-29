import { useCallback, useRef, useState } from 'react'
import { useLoggerDragHint } from '@/hooks/useLoggerDragHint'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  useBankPushups,
  useDayTotal,
  useRecordEntryEffort,
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
import { SetEffortSheet } from '@/components/logger/SetEffortSheet'
import { DayProgressCard } from '@/components/today/DayProgressCard'
import { TodayEntriesList } from '@/components/today/TodayEntriesList'
import { useAuth } from '@/providers/AuthProvider'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'

export function TodayPage() {
  const { toast } = useToast()
  const { user, profile } = useAuth()
  const { activeGroup, loading: groupLoading, role } = useActiveGroup()
  const { dailyTarget, todayPrescription, loading: planLoading, wizardCompleted } =
    useTrainingPlan(user?.id, activeGroup?.id, activeGroup?.timezone)
  const { showHint, dismissHint } = useLoggerDragHint()
  const billingStatusQuery = useGroupBillingStatus(activeGroup?.id)
  const subscriptionQuery = useGroupSubscription(activeGroup?.id)
  const { data: dayTotal = 0, isLoading: totalLoading } = useDayTotal(activeGroup)
  const { data: entries = [], isLoading: entriesLoading } = useTodayEntries(
    activeGroup,
    user?.id,
  )

  const bankPushups = useBankPushups()
  const recordEntryEffort = useRecordEntryEffort()
  const undoLastEntry = useUndoLastEntry()
  const loggerRef = useRef<CircularLoggerHandle>(null)
  const [canBank, setCanBank] = useState(false)
  const [dragCount, setDragCount] = useState(0)
  const [effortEntryId, setEffortEntryId] = useState<string | null>(null)

  const isTrainingDay =
    wizardCompleted && !todayPrescription.isRestDay && (dailyTarget ?? 0) > 0

  const closeEffortSheet = useCallback(() => {
    setEffortEntryId(null)
  }, [])

  const handleEffortSelect = useCallback(
    async (repsInReserve: number) => {
      if (!activeGroup || !effortEntryId) {
        closeEffortSheet()
        return
      }

      try {
        await recordEntryEffort.mutateAsync({
          group: activeGroup,
          entryId: effortEntryId,
          repsInReserve,
        })
      } catch {
        toast({
          message: 'Could not save effort feedback.',
          variant: 'danger',
          durationMs: 4000,
        })
      } finally {
        closeEffortSheet()
      }
    },
    [activeGroup, closeEffortSheet, effortEntryId, recordEntryEffort, toast],
  )

  const handleBank = useCallback(async () => {
    if (!activeGroup || !canBank || bankPushups.isPending || !user || !profile) {
      return
    }

    const bankedCount = loggerRef.current?.getCount() ?? 0

    if (bankedCount <= 0) {
      return
    }

    try {
      const entry = await bankPushups.mutateAsync({
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

      if (isTrainingDay && entry.id && !entry.id.startsWith('optimistic-')) {
        setEffortEntryId(entry.id)
      }

      toast({
        message: `${bankedCount} push-ups banked.`,
        variant: 'success',
        durationMs: 6000,
        actionLabel: 'Undo',
        onAction: () => {
          closeEffortSheet()
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
    closeEffortSheet,
    dismissHint,
    isTrainingDay,
    profile,
    toast,
    undoLastEntry,
    user,
  ])

  if (groupLoading || !activeGroup) {
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto h-[min(72vw,280px)] w-[min(72vw,280px)] rounded-full" />
        <Skeleton className="h-16 w-full rounded-[var(--radius-lg)]" />
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col pb-[var(--log-page-scroll-pad-inline)]">
        {billingConfig.enabled ? (
          <BillingBanner
            className="mb-3"
            billingStatus={billingStatusQuery.data ?? activeGroup.billing_status}
            subscription={subscriptionQuery.data}
            isOwner={role === 'owner'}
          />
        ) : null}

        <CircularLogger
          ref={loggerRef}
          onCountChange={setDragCount}
          onCanBankChange={setCanBank}
          onBank={handleBank}
          disabled={bankPushups.isPending}
          showDragHint={showHint}
          onHintDismiss={dismissHint}
          className="px-0 py-0"
        />

        <BankPushupsButton
          placement="inline"
          disabled={!canBank}
          loading={bankPushups.isPending}
          showDisabledHint={dragCount === 0}
          onBank={handleBank}
        />

        <DayProgressCard
          variant="compact"
          bankedToday={dayTotal}
          banksLogged={entries.length}
          loading={(totalLoading && dayTotal === 0) || planLoading}
          dailyTarget={dailyTarget}
          todayPrescription={todayPrescription}
        />

        <TodayEntriesList
          group={activeGroup}
          entries={entries}
          loading={entriesLoading && entries.length === 0}
          className="mt-4"
        />
      </div>

      <SetEffortSheet
        open={effortEntryId !== null}
        saving={recordEntryEffort.isPending}
        onSelect={(value) => void handleEffortSelect(value)}
        onSkip={closeEffortSheet}
      />
    </>
  )
}

export default TodayPage
