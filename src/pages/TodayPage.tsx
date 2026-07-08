import { useCallback, useEffect, useRef, useState } from 'react'
import { useLoggerDragHint } from '@/hooks/useLoggerDragHint'
import { useNoseHoldHint } from '@/hooks/useNoseHoldHint'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useMyAvailability } from '@/hooks/useAvailability'
import { shouldConfirmOverage } from '@/lib/overageCap'
import { OverageConfirmSheet } from '@/components/logger/OverageConfirmSheet'
import { supabase } from '@/lib/supabase'
import {
  getGroupLocalDateString,
  useBankPushups,
  useDayTotal,
  useRecordEntryEffort,
  useDayEntries,
  useUndoLastEntry,
} from '@/hooks/useTodayData'
import { useCustomActivities } from '@/hooks/useCustomActivities'
import {
  useBankCustomActivity,
  useCustomActivityBestSet,
  useCustomActivityDayEntries,
  useDeleteCustomActivityEntry,
} from '@/hooks/useCustomActivityLog'
import { getStoredLogActivityId, setStoredLogActivityId } from '@/lib/storage'
import type { SideChoice } from '@/types/customActivity'
import { useGroupBillingStatus, useGroupSubscription } from '@/hooks/useBilling'
import { BillingBanner } from '@/components/billing/BillingBanner'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { noticeInlineClass } from '@/lib/noticeStyles'
import { billingConfig } from '@/lib/billing'
import {
  CircularLogger,
  type CircularLoggerHandle,
} from '@/components/logger/CircularLogger'
import { ActivitySwitcher } from '@/components/logger/ActivitySwitcher'
import { BankPushupsButton } from '@/components/logger/BankPushupsButton'
import { CustomActivityDayCard } from '@/components/logger/CustomActivityDayCard'
import { NoseHoldHint } from '@/components/logger/NoseHoldHint'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { NoseTapMode } from '@/components/logger/NoseTapMode'
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
  const { data: availability } = useMyAvailability()
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
  const { showNoseHint, dismissNoseHint } = useNoseHoldHint()
  const billingStatusQuery = useGroupBillingStatus(activeGroup?.id)
  const subscriptionQuery = useGroupSubscription(activeGroup?.id)
  const { data: dayTotal = 0, isLoading: totalLoading } = useDayTotal(activeGroup)
  const { data: entries = [] } = useDayEntries(activeGroup, user?.id)

  const bankPushups = useBankPushups()
  const recordEntryEffort = useRecordEntryEffort()
  const undoLastEntry = useUndoLastEntry()
  const bankCustom = useBankCustomActivity()
  const deleteCustomEntry = useDeleteCustomActivityEntry()
  const loggerRef = useRef<CircularLoggerHandle>(null)
  const [canBank, setCanBank] = useState(false)
  // Calm overage confirmation: set when a bank would cross the health-guard cap.
  const [overageConfirm, setOverageConfirm] = useState<{ count: number; projected: number } | null>(
    null,
  )
  const overrideConfirmedRef = useRef(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [activitySide, setActivitySide] = useState<SideChoice>('left')
  const [effortEntryId, setEffortEntryId] = useState<string | null>(null)
  const [effortAskedToday, setEffortAskedToday] = useState(false)
  const [maxSetMode, setMaxSetMode] = useState(false)
  const [showMaxCheckInCard, setShowMaxCheckInCard] = useState(true)
  const [showSorenessSheet, setShowSorenessSheet] = useState(false)
  const [noseTapOpen, setNoseTapOpen] = useState(false)
  const [sorenessPromptedToday, setSorenessPromptedToday] = useState(false)

  const { status: sorenessStatus, saveStatus, saving: sorenessSaving } = useSorenessCheckin(
    user?.id,
    activeGroup,
    planTimezone,
  )

  useEffect(() => {
    if (!user?.id) {
      return
    }

    setSelectedActivityId(getStoredLogActivityId(user.id))
  }, [user?.id])

  const { data: customActivities = [] } = useCustomActivities(user?.id)
  const selectedActivity =
    customActivities.find((activity) => activity.id === selectedActivityId) ?? null
  const isCustomMode = selectedActivity != null
  const customLoggedFor = getGroupLocalDateString(planTimezone)
  const { data: customDayEntries = [] } = useCustomActivityDayEntries(
    selectedActivity?.id,
    customLoggedFor,
  )
  const { data: customBestSet = 0 } = useCustomActivityBestSet(selectedActivity?.id)
  const bankPending = bankPushups.isPending || bankCustom.isPending

  const handleSelectActivity = useCallback(
    (activityId: string | null) => {
      setSelectedActivityId(activityId)
      setActivitySide('left')
      // Reset the ring so reps dialled for one activity can't land in another.
      loggerRef.current?.reset()

      if (user?.id) {
        setStoredLogActivityId(user.id, activityId)
      }
    },
    [user?.id],
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

    // Calm health-guard confirmation on a very big day (skipped for a deliberate
    // max-set check-in). Confirming records the override on the entry.
    const wasOverride = overrideConfirmedRef.current
    overrideConfirmedRef.current = false
    if (
      !isMaxCheckin &&
      !wasOverride &&
      shouldConfirmOverage(dayTotal, bankedCount, {
        dailyTarget,
        maxCleanSet: plan?.max_clean_set,
      })
    ) {
      setOverageConfirm({ count: bankedCount, projected: dayTotal + bankedCount })
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
        isMaxCheckin,
      })
      loggerRef.current?.unwind()
      dismissHint()

      if (wasOverride && entry?.id && !entry.id.startsWith('optimistic-')) {
        void supabase.rpc('mark_entry_override', { p_entry_id: entry.id })
      }

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
    dailyTarget,
    dayTotal,
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

  const confirmOverage = useCallback(() => {
    overrideConfirmedRef.current = true
    setOverageConfirm(null)
    void handleBank()
  }, [handleBank])

  const handleBankCustom = useCallback(async () => {
    if (!selectedActivity || !user || !canBank || bankCustom.isPending) {
      return
    }

    const bankedCount = loggerRef.current?.getCount() ?? 0

    if (bankedCount <= 0) {
      return
    }

    const entrySide = selectedActivity.track_sides ? activitySide : null

    try {
      const inserted = await bankCustom.mutateAsync({
        activityId: selectedActivity.id,
        userId: user.id,
        count: bankedCount,
        side: entrySide,
        loggedFor: customLoggedFor,
      })
      loggerRef.current?.unwind()
      dismissHint()

      // Single-side work alternates naturally (left set, then right) — flip the
      // toggle so the next bank lands on the other side by default. 'Both' stays.
      if (entrySide === 'left' || entrySide === 'right') {
        setActivitySide(entrySide === 'left' ? 'right' : 'left')
      }

      toast({
        message:
          entrySide === 'both'
            ? `${bankedCount} ${selectedActivity.name} banked — both sides.`
            : `${bankedCount} ${selectedActivity.name}${entrySide ? ` (${entrySide})` : ''} banked.`,
        variant: 'success',
        durationMs: 6000,
        actionLabel: 'Undo',
        onAction: () => {
          // 'Both' writes two entries — undo removes them all.
          inserted.forEach((row, index) => {
            deleteCustomEntry.mutate(
              {
                entryId: row.id,
                activityId: selectedActivity.id,
                loggedFor: row.logged_for,
              },
              index === 0
                ? {
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
                  }
                : undefined,
            )
          })
        },
      })
    } catch {
      toast({
        message: `Could not bank ${selectedActivity.name}. Try again.`,
        variant: 'danger',
        durationMs: 5000,
      })
    }
  }, [
    activitySide,
    bankCustom,
    canBank,
    customLoggedFor,
    deleteCustomEntry,
    dismissHint,
    selectedActivity,
    toast,
    user,
  ])

  const handleBankActive = isCustomMode ? handleBankCustom : handleBank

  const handleNoseTapBank = useCallback(
    async (count: number) => {
      if (!activeGroup || !user || !profile || bankPushups.isPending || count <= 0) {
        return
      }

      try {
        await bankPushups.mutateAsync({
          group: activeGroup,
          count,
          userId: user.id,
          profile: {
            user_id: user.id,
            display_name: profile.display_name,
            avatar_emoji: profile.avatar_emoji,
            avatar_color: profile.avatar_color,
          },
          isMaxCheckin: false,
        })
        setNoseTapOpen(false)
        toast({
          message: `${count} nose-tap push-ups banked.`,
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
    },
    [activeGroup, bankPushups, profile, toast, undoLastEntry, user],
  )

  if (groupLoading || !activeGroup) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-[var(--radius-lg)]" />
        <Skeleton className="mx-auto h-[min(72vw,336px)] w-[min(72vw,336px)] rounded-full" />
      </div>
    )
  }

  const showCheckIn =
    !isCustomMode &&
    hasPlan &&
    showMaxCheckInCard &&
    todayPrescription?.suggestMaxCheckIn &&
    !maxSetMode &&
    !sorenessSuppressesMaxCheckIn(sorenessStatus)

  return (
    <>
      <div className="flex min-h-[calc(100dvh-var(--bottom-nav-height)-1.5rem)] flex-col pb-2 pt-4">
        {billingConfig.enabled ? (
          <BillingBanner
            className="mb-3"
            billingStatus={billingStatusQuery.data ?? activeGroup.billing_status}
            subscription={subscriptionQuery.data}
            isOwner={role === 'owner'}
          />
        ) : null}

        {availability && availability.status !== 'active' ? (
          <p className={cn(noticeInlineClass('accent'), 'mb-2 text-text-muted')}>
            You&apos;re marked {availability.status === 'injured' ? 'injured' : 'out'} — reminders
            and your plan are paused, streak protected. Logging still works; set yourself back in
            Settings when you&apos;re ready.
          </p>
        ) : null}

        {maxSetMode && !isCustomMode ? (
          <p className={cn(noticeInlineClass('accent'), 'mb-2 font-medium')}>
            Max set mode — one clean set, stop when form breaks.
          </p>
        ) : null}

        {showCheckIn ? (
          <ChallengeMaxCheckInCard
            maxSetModeActive={maxSetMode}
            onTryMaxSet={() => setMaxSetMode(true)}
            onStickToPlan={() => setShowMaxCheckInCard(false)}
          />
        ) : null}

        {isCustomMode && selectedActivity ? (
          <CustomActivityDayCard
            activity={selectedActivity}
            entries={customDayEntries}
            allTimeBest={customBestSet}
          />
        ) : (
          <DayProgressCard
            variant="compact"
            className="w-full"
            bankedToday={dayTotal}
            banksLogged={entries.length}
            loading={(totalLoading && dayTotal === 0) || planLoading}
            hasPlan={hasPlan}
            dailyTarget={dailyTarget}
            todayPrescription={todayPrescription}
          />
        )}

        <div className="flex flex-1 flex-col items-center justify-center py-1">
          <ActivitySwitcher
            activities={customActivities}
            selectedActivityId={selectedActivity?.id ?? null}
            onSelect={handleSelectActivity}
            disabled={bankPending}
            className="mb-2"
          />

          <CircularLogger
            ref={loggerRef}
            onCanBankChange={setCanBank}
            onBank={handleBankActive}
            onLongPressCenter={isCustomMode ? undefined : () => setNoseTapOpen(true)}
            disabled={bankPending}
            showDragHint={showHint}
            onHintDismiss={dismissHint}
            className="px-0 py-0"
          />

          {isCustomMode && selectedActivity?.track_sides ? (
            <SegmentedControl
              className="mt-2 w-full max-w-[17rem]"
              options={[
                { value: 'left', label: 'Left' },
                { value: 'both', label: 'Both' },
                { value: 'right', label: 'Right' },
              ]}
              value={activitySide}
              onChange={setActivitySide}
              ariaLabel={`${selectedActivity.name} side`}
            />
          ) : null}

          <Button
            type="button"
            variant="secondary"
            disabled={bankPending}
            onClick={() => loggerRef.current?.addReps(10)}
            aria-label="Add 10 reps"
            className="mt-2 min-h-11 px-8"
          >
            +10
          </Button>

          <BankPushupsButton
            placement="inline"
            disabled={!canBank}
            loading={bankPending}
            onBank={handleBankActive}
            label={
              isCustomMode && selectedActivity
                ? selectedActivity.track_sides
                  ? `Bank ${selectedActivity.name} (${activitySide})`
                  : `Bank ${selectedActivity.name}`
                : undefined
            }
            className="mt-2 transition-opacity duration-[var(--duration-fast)]"
          />
        </div>

        {isCustomMode ? null : <NoseHoldHint show={showNoseHint} onDismiss={dismissNoseHint} />}
      </div>

      <NoseTapMode
        open={noseTapOpen}
        banking={bankPushups.isPending}
        onBank={(count) => void handleNoseTapBank(count)}
        onExit={() => setNoseTapOpen(false)}
      />

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

      <OverageConfirmSheet
        open={overageConfirm !== null}
        projectedTotal={overageConfirm?.projected ?? 0}
        saving={bankPushups.isPending}
        onConfirm={confirmOverage}
        onCancel={() => setOverageConfirm(null)}
      />
    </>
  )
}

export default TodayPage
