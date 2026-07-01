import { useCallback, useRef, useState } from 'react'
import { useLoggerDragHint } from '@/hooks/useLoggerDragHint'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  useBankPushups,
  useDayTotal,
  useRecordEntryEffort,
  useDayEntries,
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
import { SorenessCheckInSheet } from '@/components/logger/SorenessCheckInSheet'
import { ChallengeMaxCheckInCard } from '@/components/today/ChallengeMaxCheckInCard'
import { DayProgressCard } from '@/components/today/DayProgressCard'
import { useAuth } from '@/providers/AuthProvider'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'
import { useSorenessCheckin } from '@/hooks/useSorenessCheckin'
import { effortRatingToRir, shouldAskEffortFeedback } from '@/lib/training/effortRating'
import type { EffortRating } from '@/lib/training/effortRating'
import {
  shouldPromptSorenessCheckIn,
  sorenessSuppressesMaxCheckIn,
} from '@/lib/training/sorenessCheckin'

export function TodayPage() {
  const { toast } = useToast()
  const { user, profile } = useAuth()
  const { activeGroup, loading: groupLoading, role } = useActiveGroup()
  const planTimezone = profile?.timezone || activeGroup?.timezone || 'UTC'
  const {
    dailyTarget,
    todayPrescription,
    loading: planLoading,
    wizardCompleted,
    hasPlan,
    plan,
  } = useTrainingPlan(user?.id, activeGroup?.id, planTimezone)
  const { showHint, dismissHint } = useLoggerDragHint()
  const billingStatusQuery = useGroupBillingStatus(activeGroup?.id)
  const subscriptionQuery = useGroupSubscription(activeGroup?.id)
  const { data: dayTotal = 0, isLoading: totalLoading } = useDayTotal(activeGroup)
  const { data: entries = [] } = useDayEntries(activeGroup, user?.id)

  const bankPushups = useBankPushups()
  const recordEntryEffort = useRecordEntryEffort()
  const undoLastEntry = useUndoLastEntry()
  const loggerRef = useRef<CircularLoggerHandle>(null)
  const [canBank, setCanBank] = useState(false)
  const [dragCount, setDragCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [effortEntryId, setEffortEntryId] = useState<string | null>(null)
  const [effortAskedToday, setEffortAskedToday] = useState(false)
  const [maxSetMode, setMaxSetMode] = useState(false)
  const [showMaxCheckInCard, setShowMaxCheckInCard] = useState(true)
  const [showSorenessSheet, setShowSorenessSheet] = useState(false)
  const [sorenessPromptedToday, setSorenessPromptedToday] = useState(false)

  const { status: sorenessStatus, saveStatus, saving: sorenessSaving } = useSorenessCheckin(
    user?.id,
    activeGroup,
    planTimezone,
  )

  const isTrainingDay =
    hasPlan &&
    todayPrescription != null &&
    !todayPrescription.isRestDay &&
    (dailyTarget ?? 0) > 0

  const closeEffortSheet = useCallback(() => {
    setEffortEntryId(null)
  }, [])

  const handleEffortSelect = useCallback(
    async (rating: EffortRating) => {
      if (!activeGroup || !effortEntryId) {
        closeEffortSheet()
        return
      }

      try {
        await recordEntryEffort.mutateAsync({
          group: activeGroup,
          entryId: effortEntryId,
          repsInReserve: effortRatingToRir(rating),
        })
        setEffortAskedToday(true)

        if (
          rating === 'hard' &&
          todayPrescription?.dayType === 'challenge' &&
          shouldPromptSorenessCheckIn({
            wasChallengeDay: true,
            lastEffortWasHard: true,
            alreadyCheckedInToday: sorenessStatus != null || sorenessPromptedToday,
          })
        ) {
          setShowSorenessSheet(true)
        }
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
    [activeGroup, closeEffortSheet, effortEntryId, recordEntryEffort, sorenessPromptedToday, sorenessStatus, todayPrescription?.dayType, toast],
  )

  const handleBank = useCallback(async () => {
    if (!activeGroup || !canBank || bankPushups.isPending || !user || !profile) {
      return
    }

    const bankedCount = loggerRef.current?.getCount() ?? 0

    if (bankedCount <= 0) {
      return
    }

    const isMaxCheckin = maxSetMode

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
        isMaxCheckin,
      })
      loggerRef.current?.reset()
      setDragCount(0)
      dismissHint()

      if (isMaxCheckin) {
        setMaxSetMode(false)
        if (plan?.pending_max_clean_update && bankedCount > (plan.max_clean_set ?? 0)) {
          toast({
            message: `Nice — clean max looks like ${bankedCount}. Check Settings to update your plan.`,
            variant: 'success',
            durationMs: 8000,
          })
        } else if (bankedCount > (plan?.max_clean_set ?? 0)) {
          toast({
            message: `Max set logged: ${bankedCount}. Check Settings if you want to update your plan.`,
            variant: 'success',
            durationMs: 8000,
          })
        }
      }

      const setsPlanned = todayPrescription?.sets ?? 0
      const banksAfter = entries.length + 1
      const shouldAsk =
        isTrainingDay &&
        entry.id &&
        !entry.id.startsWith('optimistic-') &&
        shouldAskEffortFeedback({
          wizardCompleted,
          isRestDay: todayPrescription?.isRestDay ?? true,
          banksLogged: banksAfter,
          setsPlanned,
          effortAskedToday,
          dayType: todayPrescription?.dayType ?? 'rest',
        })

      if (shouldAsk) {
        setEffortEntryId(entry.id)
      } else if (
        todayPrescription?.dayType === 'challenge' &&
        banksAfter >= setsPlanned &&
        shouldPromptSorenessCheckIn({
          wasChallengeDay: true,
          lastEffortWasHard: false,
          alreadyCheckedInToday: sorenessStatus != null || sorenessPromptedToday,
        })
      ) {
        setShowSorenessSheet(true)
      }

      toast({
        message: isMaxCheckin
          ? `${bankedCount} push-ups logged as max set.`
          : `${bankedCount} push-ups banked.`,
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
    effortAskedToday,
    entries.length,
    isTrainingDay,
    maxSetMode,
    plan,
    profile,
    todayPrescription,
    toast,
    undoLastEntry,
    user,
    sorenessPromptedToday,
    sorenessStatus,
    wizardCompleted,
  ])

  const showBankButton = isDragging || dragCount > 0

  if (groupLoading || !activeGroup) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-[var(--radius-lg)]" />
        <Skeleton className="mx-auto h-[min(72vw,308px)] w-[min(72vw,308px)] rounded-full" />
      </div>
    )
  }

  const showCheckIn =
    hasPlan &&
    showMaxCheckInCard &&
    todayPrescription?.suggestMaxCheckIn &&
    !maxSetMode &&
    !sorenessSuppressesMaxCheckIn(sorenessStatus)

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

        {maxSetMode ? (
          <p className="mb-2 rounded-[var(--radius-md)] border border-accent/40 bg-accent-muted/30 px-3 py-2 text-xs font-medium text-text-primary">
            Max set mode — one clean set, stop when form breaks.
          </p>
        ) : null}

        <DayProgressCard
          variant="compact"
          bankedToday={dayTotal}
          banksLogged={entries.length}
          loading={(totalLoading && dayTotal === 0) || planLoading}
          hasPlan={hasPlan}
          dailyTarget={dailyTarget}
          todayPrescription={todayPrescription}
        />

        {showCheckIn ? (
          <ChallengeMaxCheckInCard
            maxSetModeActive={maxSetMode}
            onTryMaxSet={() => setMaxSetMode(true)}
            onStickToPlan={() => setShowMaxCheckInCard(false)}
          />
        ) : null}

        <CircularLogger
          ref={loggerRef}
          onCountChange={setDragCount}
          onCanBankChange={setCanBank}
          onDraggingChange={setIsDragging}
          onBank={handleBank}
          disabled={bankPushups.isPending}
          showDragHint={showHint}
          onHintDismiss={dismissHint}
          className="px-0 py-0"
        />

        {showBankButton ? (
          <BankPushupsButton
            placement="inline"
            disabled={!canBank}
            loading={bankPushups.isPending}
            onBank={handleBank}
            className="transition-opacity duration-[var(--duration-fast)]"
          />
        ) : null}
      </div>

      <SetEffortSheet
        open={effortEntryId !== null}
        saving={recordEntryEffort.isPending}
        onSelect={(rating) => void handleEffortSelect(rating)}
        onSkip={() => {
          setEffortAskedToday(true)
          closeEffortSheet()
        }}
      />

      <SorenessCheckInSheet
        open={showSorenessSheet}
        saving={sorenessSaving}
        onSelect={(status) => {
          void saveStatus(status).then(() => {
            setSorenessPromptedToday(true)
            setShowSorenessSheet(false)
          })
        }}
        onSkip={() => {
          setSorenessPromptedToday(true)
          setShowSorenessSheet(false)
        }}
      />
    </>
  )
}

export default TodayPage
