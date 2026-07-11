import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card } from '@/components/ui'
import { WizardStepHeader } from '@/components/training/WizardStepHeader'
import {
  DAY_LABELS,
  dayTypeBadgeVariant,
  DEFAULT_PREFERRED_TRAINING_DAYS,
  formatDayTarget,
  formatDayTypeSetsSummary,
  getDayTypeDisplayLabel,
  MESOCYCLE_MULTIPLIER,
  recommendFromWizard,
  type WizardAnswers,
} from '@/lib/training/planEngine'
import { noticeInlineClass } from '@/lib/noticeStyles'
import { prefersReducedMotion } from '@/lib/motion'
import {
  buildTrustModeLabel,
  deriveHistoryConfidence,
  derivePlanCalibration,
  hasUsableVolumeHistory,
  HISTORY_WINDOW_DAYS,
  logsQualifyTrusted,
  parseCalibrationNote,
  shouldPrefillDailyAverage,
  shouldShowDailyAverageQuestion,
  suggestWizardPrefill,
  type VolumeHistoryStats,
} from '@/lib/training/volumeCalibration'
import {
  getTrainingDayWarnings,
  shouldNormalizeLegacyTrainingDays,
  shouldShowManualAverageConfirm,
  WIZARD_PREVIEW_LABELS,
} from '@/lib/training/wizardUi'

const DEFAULT_ANSWERS: WizardAnswers = {
  maxCleanSet: 15,
  trainingLevel: 'beginner',
  preferredTrainingDays: [...DEFAULT_PREFERRED_TRAINING_DAYS],
  sorenessWarningAcknowledged: false,
  wizardSorenessLevel: 'none',
  challengeIntensity: 'moderate',
  recentDailyAverage: null,
}

const STEP_TITLES = ['Your capacity', 'Your week', 'Preview plan'] as const

const INTENSITY_HINTS: Record<WizardAnswers['challengeIntensity'], string> = {
  light: 'Easier challenge days',
  moderate: 'Balanced (default)',
  intense: 'Harder challenge days',
}

type TrainingWizardProps = {
  saving?: boolean
  initialAnswers?: WizardAnswers | null
  savedAnswersReady?: boolean
  historyStats?: VolumeHistoryStats | null
  historyLoading?: boolean
  onComplete?: (answers: WizardAnswers) => void | Promise<void>
  onSkip?: () => void
}

function parseRecentDailyAverage(raw: string): number | null {
  if (raw === '') {
    return null
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return Math.round(parsed)
}

export function TrainingWizard({
  saving = false,
  initialAnswers = null,
  savedAnswersReady = true,
  historyStats = null,
  historyLoading = false,
  onComplete,
  onSkip,
}: TrainingWizardProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<WizardAnswers>(initialAnswers ?? DEFAULT_ANSWERS)
  const initializedRef = useRef(false)
  const stepHeadingRef = useRef<HTMLParagraphElement>(null)
  const stepChangeMountedRef = useRef(false)
  const [userEditedDailyAvg, setUserEditedDailyAvg] = useState(false)
  const [logSuggestedDailyAvg, setLogSuggestedDailyAvg] = useState<number | null>(null)
  const [showOffAppTraining, setShowOffAppTraining] = useState(false)
  const [confirmedOffAppTraining, setConfirmedOffAppTraining] = useState(false)
  const savedInitialAvgRef = useRef<number | null>(null)

  const logsTrusted = logsQualifyTrusted(historyStats)
  const savedManualConfirmed =
    initialAnswers?.manualConfirmedRegularTraining ??
    parseCalibrationNote(initialAnswers?.storedCalibrationNote).manualConfirmed

  useEffect(() => {
    if (!savedAnswersReady || initializedRef.current) {
      return
    }

    initializedRef.current = true
    const nextAnswers = initialAnswers ?? DEFAULT_ANSWERS
    savedInitialAvgRef.current = nextAnswers.recentDailyAverage ?? null

    let preferredTrainingDays = nextAnswers.preferredTrainingDays
    if (
      shouldNormalizeLegacyTrainingDays(
        preferredTrainingDays,
        nextAnswers.storedCalibrationNote,
      )
    ) {
      preferredTrainingDays = [...DEFAULT_PREFERRED_TRAINING_DAYS]
    }

    setAnswers({ ...nextAnswers, preferredTrainingDays })

    if (savedManualConfirmed) {
      setConfirmedOffAppTraining(true)
      setShowOffAppTraining(true)
    } else if (nextAnswers.recentDailyAverage != null) {
      setShowOffAppTraining(true)
    }
  }, [savedAnswersReady, initialAnswers, savedManualConfirmed])

  useEffect(() => {
    if (!savedAnswersReady || historyLoading || !historyStats || !shouldPrefillDailyAverage(deriveHistoryConfidence(historyStats))) {
      return
    }

    const prefill = suggestWizardPrefill(historyStats, initialAnswers?.maxCleanSet)

    if (prefill.recentDailyAverage != null) {
      setLogSuggestedDailyAvg(prefill.recentDailyAverage)
    }

    setAnswers((current) => {
      if (userEditedDailyAvg) {
        return current
      }

      if (
        current.recentDailyAverage != null &&
        prefill.recentDailyAverage != null &&
        current.recentDailyAverage !== prefill.recentDailyAverage
      ) {
        return current
      }

      const updates: Partial<WizardAnswers> = {}

      if (current.recentDailyAverage == null && prefill.recentDailyAverage != null) {
        updates.recentDailyAverage = prefill.recentDailyAverage
      }

      if (Object.keys(updates).length === 0) {
        return current
      }

      return { ...current, ...updates }
    })
  }, [savedAnswersReady, historyLoading, historyStats, initialAnswers, userEditedDailyAvg])

  // On step change, reset scroll to the top and move focus to the step title so
  // the next (often shorter) step doesn't render mid-page and the change is
  // announced to screen readers instead of leaving focus on the dock button.
  useEffect(() => {
    if (!stepChangeMountedRef.current) {
      stepChangeMountedRef.current = true
      return
    }

    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    stepHeadingRef.current?.focus()
  }, [step])

  const offAppConfirmed =
    confirmedOffAppTraining || Boolean(answers.manualConfirmedRegularTraining)

  const calibrationAnswers = useMemo(
    (): WizardAnswers => ({
      ...answers,
      storedCalibrationNote: null,
    }),
    [answers],
  )

  const calibration = useMemo(
    () =>
      derivePlanCalibration(calibrationAnswers, historyLoading ? null : historyStats, {
        manualConfirmedRegularTraining: offAppConfirmed && !logsTrusted,
      }),
    [calibrationAnswers, historyStats, historyLoading, offAppConfirmed, logsTrusted],
  )

  const historyPrefill = useMemo(
    () => suggestWizardPrefill(historyStats, initialAnswers?.maxCleanSet),
    [historyStats, initialAnswers?.maxCleanSet],
  )

  const recommendation = useMemo(
    () =>
      recommendFromWizard(calibrationAnswers, {
        initialBaseline: calibration.initialBaseline,
        startMesocycleWeek: calibration.startMesocycleWeek,
        volumeContext: calibration.volumeContext,
      }),
    [calibrationAnswers, calibration.initialBaseline, calibration.startMesocycleWeek, calibration.volumeContext],
  )

  const historyConfidence = deriveHistoryConfidence(historyStats)
  const showHistory = hasUsableVolumeHistory(historyStats)
  const showDailyAverage = shouldShowDailyAverageQuestion(historyConfidence) || showOffAppTraining
  const showStaleBanner =
    historyConfidence === 'stale' &&
    historyStats?.daysSinceLastLog != null &&
    historyStats.daysSinceLastLog > 0
  const startWeek = calibration.startMesocycleWeek
  const daysSelected = answers.preferredTrainingDays.length
  // A plan with no training days is invalid — block Continue/Save until one is picked.
  const canSave = answers.sorenessWarningAcknowledged && daysSelected > 0
  const dayWarnings = getTrainingDayWarnings(daysSelected, answers.challengeIntensity)
  const suggestedSetsSummary = formatDayTypeSetsSummary(recommendation.plan.weeklySchedule)
  const hardestDayTarget = recommendation.plan.peakDayTarget
  const showManualConfirmCheckbox = shouldShowManualAverageConfirm(
    answers.recentDailyAverage,
    historyLoading ? null : historyStats,
  )

  const showLogSuggestion =
    logSuggestedDailyAvg != null &&
    answers.recentDailyAverage === logSuggestedDailyAvg &&
    !userEditedDailyAvg

  function toggleDay(day: number) {
    setAnswers((current) => {
      const days = new Set(current.preferredTrainingDays)
      if (days.has(day)) {
        days.delete(day)
      } else {
        days.add(day)
      }

      return {
        ...current,
        preferredTrainingDays: [...days].sort((a, b) => a - b),
      }
    })
  }

  function handleFinish() {
    if (!canSave) {
      return
    }
    onComplete?.({
      ...answers,
      manualConfirmedRegularTraining: offAppConfirmed && !logsTrusted,
    })
  }

  return (
    <>
      <div className="space-y-4 pb-[calc(var(--bottom-nav-height)+var(--wizard-dock-height)+1rem)]">
        <WizardStepHeader
          ref={stepHeadingRef}
          step={step}
          totalSteps={STEP_TITLES.length}
          title={STEP_TITLES[step]}
        />

        {step === 0 ? (
          <Card padding="md" className="space-y-5">
            {showStaleBanner ? (
              <p className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-xs text-text-primary">
                Last logged {historyStats?.daysSinceLastLog} days ago — targets will adjust
                quickly once you start banking sets.
              </p>
            ) : null}

            {historyConfidence === 'stale' && !historyLoading && !showStaleBanner ? (
              <p className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-xs text-text-primary">
                We don&apos;t have recent PushUS logs — start from your best single set. Week 1
                targets will tune from your logged push-ups.
              </p>
            ) : null}

            <div>
              <p className="text-sm font-medium text-text-primary">Max clean set</p>
              <p className="mt-1 text-xs text-text-muted">
                How many push-ups in one go with good form? Stop when form breaks — not your daily
                total. Daily habit + safe gradual fitness.
              </p>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              step={1}
              value={answers.maxCleanSet}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  maxCleanSet: Number(event.target.value),
                }))
              }
              className="mb-1 w-full accent-accent"
            />
            <div className="mb-3 flex justify-between px-0.5 text-[0.65rem] font-medium text-text-muted">
              <span>1</span>
              <span>60</span>
            </div>
            <p className="rounded-[var(--radius-md)] border border-border bg-bg py-3 text-center font-mono text-2xl font-bold text-text-primary">
              {answers.maxCleanSet}
            </p>

            <div className="space-y-2">
              {historyLoading ? (
                <p className="text-xs text-text-muted">Loading your recent PushUS logs…</p>
              ) : null}

              {showHistory && historyStats ? (
                <div className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-3">
                  <p className="text-xs font-semibold text-text-primary">
                    From your PushUS logs (last {HISTORY_WINDOW_DAYS} days)
                  </p>
                  <p className="mt-1 text-sm text-text-primary">
                    Avg{' '}
                    <span className="font-mono font-bold">
                      {Math.round(historyStats.avgDailyTotal)}
                    </span>
                    /day · Best day{' '}
                    <span className="font-mono font-bold">{historyStats.peakDailyTotal}</span> ·
                    Largest bank{' '}
                    <span className="font-mono font-bold">{historyStats.peakBank}</span>
                  </p>
                  <p className="mt-2 text-xs text-text-muted">
                    Max clean caps set size; recent average shapes set count and daily targets.
                  </p>
                </div>
              ) : null}

              {historyPrefill.suggestedMaxCleanFromHistory != null &&
              historyPrefill.suggestedMaxCleanFromHistory !== answers.maxCleanSet ? (
                <p className="text-xs text-text-muted">
                  Logs suggest around{' '}
                  <span className="font-mono font-semibold text-text-primary">
                    {historyPrefill.suggestedMaxCleanFromHistory}
                  </span>{' '}
                  for max clean — update above if that looks right.
                </p>
              ) : null}

              {historyConfidence === 'stale' && !showOffAppTraining ? (
                <button
                  type="button"
                  onClick={() => setShowOffAppTraining(true)}
                  className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                >
                  I&apos;ve been training off-app — add a rough daily average
                </button>
              ) : null}

              {showDailyAverage ? (
                <>
                  <label htmlFor="recent-daily-average" className="text-sm font-medium text-text-primary">
                    Over the last {HISTORY_WINDOW_DAYS} days, how many reps have you averaged per day?
                    {historyConfidence === 'partial' ? (
                      <span className="ml-1 font-normal text-text-muted">(optional)</span>
                    ) : null}
                  </label>
                  <p className="text-xs text-text-muted">
                    {historyConfidence === 'partial'
                      ? 'Only if you have been training regularly — skip if unsure.'
                      : 'Your total reps logged each day — not your max in one set. Leave blank if you are new or unsure.'}
                  </p>
                  <div className="relative">
                    <input
                      id="recent-daily-average"
                      type="number"
                      min={0}
                      max={500}
                      step={1}
                      inputMode="numeric"
                      placeholder="e.g. 58"
                      value={answers.recentDailyAverage ?? ''}
                      onChange={(event) => {
                        setUserEditedDailyAvg(true)
                        const raw = event.target.value.trim()
                        const parsed = parseRecentDailyAverage(raw)
                        if (
                          parsed !== savedInitialAvgRef.current &&
                          parsed !== answers.recentDailyAverage
                        ) {
                          setConfirmedOffAppTraining(false)
                        }
                        setAnswers((current) => ({
                          ...current,
                          recentDailyAverage: parsed,
                          manualConfirmedRegularTraining: false,
                        }))
                      }}
                      className="w-full rounded-[var(--radius-md)] border border-border bg-surface py-2.5 pl-3 pr-16 text-sm text-text-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-text-muted">
                      reps/day
                    </span>
                  </div>
                  {showLogSuggestion ? (
                    <p className="text-xs text-text-muted">
                      Suggested from your logs:{' '}
                      <span className="font-mono font-semibold text-text-primary">
                        {logSuggestedDailyAvg}
                      </span>
                      /day
                    </p>
                  ) : null}

                  {showManualConfirmCheckbox ? (
                    <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3">
                      <input
                        type="checkbox"
                        checked={confirmedOffAppTraining}
                        onChange={(event) => setConfirmedOffAppTraining(event.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-accent"
                      />
                      <span className="text-xs leading-relaxed text-text-muted">
                        <span className="font-medium text-text-primary">
                          I&apos;ve genuinely been averaging about this recently
                        </span>
                        <br />
                        Use this if you&apos;ve been training outside PushUS or your logs are
                        accurate.
                      </span>
                    </label>
                  ) : null}
                </>
              ) : null}

              {calibration.maxCleanMismatchWarning ? (
                <p className={noticeInlineClass('warning')}>
                  {calibration.maxCleanMismatchWarning}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">
                Any shoulder, elbow, or wrist soreness lately?
              </p>
              <div role="group" aria-label="Recent soreness" className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['none', 'None'],
                    ['mild', 'A little'],
                    ['notable', 'Noticeable'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={(answers.wizardSorenessLevel ?? 'none') === value}
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        wizardSorenessLevel: value,
                      }))
                    }
                    className={`min-h-11 rounded-[var(--radius-md)] border px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] active:scale-[0.97] ${
                      (answers.wizardSorenessLevel ?? 'none') === value
                        ? 'border-accent bg-accent-muted text-accent'
                        : 'border-border bg-surface text-text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(answers.wizardSorenessLevel ?? 'none') === 'notable' ? (
                <p className="text-xs text-text-muted">
                  We&apos;ll keep targets conservative and skip max-test suggestions until you feel
                  better.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Experience level</p>
              <div role="group" aria-label="Experience level" className="grid grid-cols-3 gap-2">
                {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={answers.trainingLevel === level}
                    onClick={() => setAnswers((current) => ({ ...current, trainingLevel: level }))}
                    className={`min-h-11 rounded-[var(--radius-md)] border px-2 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] active:scale-[0.97] ${
                      answers.trainingLevel === level
                        ? 'border-accent bg-accent-muted text-accent'
                        : 'border-border bg-surface text-text-muted'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card padding="md" className="space-y-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Training days</p>
              <p className="mt-1 text-xs text-text-muted">
                Pick the days you want to train. Rest days are built in automatically.
              </p>
            </div>
            <div role="group" aria-label="Training days" className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={answers.preferredTrainingDays.includes(index)}
                  onClick={() => toggleDay(index)}
                  className={`flex min-h-11 flex-col items-center justify-center rounded-[var(--radius-md)] border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] active:scale-[0.97] ${
                    answers.preferredTrainingDays.includes(index)
                      ? 'border-accent bg-accent-muted text-accent'
                      : 'border-border bg-surface text-text-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              {daysSelected} day{daysSelected === 1 ? '' : 's'} selected
            </p>
            {dayWarnings.map((warning) => (
              <p key={warning} className={noticeInlineClass('warning')}>
                {warning}
              </p>
            ))}

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Challenge intensity</p>
              <div role="group" aria-label="Challenge intensity" className="grid grid-cols-3 gap-2">
                {(['light', 'moderate', 'intense'] as const).map((intensity) => (
                  <button
                    key={intensity}
                    type="button"
                    aria-pressed={answers.challengeIntensity === intensity}
                    onClick={() =>
                      setAnswers((current) => ({ ...current, challengeIntensity: intensity }))
                    }
                    className={`min-h-11 rounded-[var(--radius-md)] border px-2 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] active:scale-[0.97] ${
                      answers.challengeIntensity === intensity
                        ? 'border-accent bg-accent-muted text-accent'
                        : 'border-border bg-surface text-text-muted'
                    }`}
                  >
                    {intensity}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-muted">{INTENSITY_HINTS[answers.challengeIntensity]}</p>
            </div>
          </Card>
        ) : null}

        {step === 2 ? (
          historyLoading ? (
            <Card padding="md" className="space-y-3">
              <p className="text-sm text-text-muted">Loading your PushUS history…</p>
            </Card>
          ) : (
          <Card padding="md" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-text-primary">Your 4-week plan</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{buildTrustModeLabel(calibration.volumeContext)}</Badge>
                <Badge variant="accent">
                  Week {startWeek} · {Math.round(MESOCYCLE_MULTIPLIER[startWeek] * 100)}% volume
                </Badge>
              </div>
            </div>

            <p className="text-sm text-text-muted">{recommendation.summary}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5">
                <p className="text-xs text-text-muted">{WIZARD_PREVIEW_LABELS.hardestDay}</p>
                <p className="font-mono text-lg font-bold text-text-primary">
                  {hardestDayTarget}
                </p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5">
                <p className="text-xs text-text-muted">{WIZARD_PREVIEW_LABELS.suggestedSets}</p>
                <p className="text-sm font-medium leading-snug text-text-primary">
                  {suggestedSetsSummary || '—'}
                </p>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-border sm:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-bg text-text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Day</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {DAY_LABELS.map((label, index) => {
                    const day =
                      recommendation.plan.weeklySchedule[index as 0 | 1 | 2 | 3 | 4 | 5 | 6]
                    return (
                      <tr key={label} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-text-primary">{label}</td>
                        <td className="px-3 py-2 capitalize text-text-muted">
                          <Badge variant={dayTypeBadgeVariant(day.dayType)} className="capitalize">
                            {getDayTypeDisplayLabel(day.dayType, answers.maxCleanSet)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-text-primary">
                          {day.target > 0 ? formatDayTarget(day) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 sm:hidden">
              {DAY_LABELS.map((label, index) => {
                const day = recommendation.plan.weeklySchedule[index as 0 | 1 | 2 | 3 | 4 | 5 | 6]
                return (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{label}</span>
                      <Badge variant={dayTypeBadgeVariant(day.dayType)} className="capitalize">
                        {getDayTypeDisplayLabel(day.dayType, answers.maxCleanSet)}
                      </Badge>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-text-primary">
                      {day.target > 0 ? formatDayTarget(day) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            {calibration.previewNote ? (
              <p className="text-xs text-text-muted">{calibration.previewNote}</p>
            ) : null}

            {calibration.volumeContext.trustMode === 'partial' &&
            calibration.volumeContext.volumeAnchorSource === 'manual' &&
            showManualConfirmCheckbox &&
            !offAppConfirmed ? (
              <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3">
                <input
                  type="checkbox"
                  checked={confirmedOffAppTraining}
                  onChange={(event) => setConfirmedOffAppTraining(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-accent"
                />
                <span className="text-xs leading-relaxed text-text-muted">
                  Use my recent average as trusted volume — check to unlock a fuller plan.
                </span>
              </label>
            ) : null}

            <p className="text-xs text-text-muted">
              Volume builds over 4 weeks: ramp in, peak, then deload. Week 1 also tunes from your
              logged push-ups. Targets adjust each week based on progress.
            </p>

            <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3">
              <input
                type="checkbox"
                checked={answers.sorenessWarningAcknowledged}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    sorenessWarningAcknowledged: event.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 accent-accent"
              />
              <span className="text-xs leading-relaxed text-text-muted">
                I understand soreness guidance: general fitness only, not medical advice. I will
                stop if I feel pain.
              </span>
            </label>
            {!answers.sorenessWarningAcknowledged ? (
              <p className="text-xs text-text-muted">Tick the box above to save your plan.</p>
            ) : null}
            <p className="text-xs text-text-muted">{recommendation.plan.disclaimer}</p>
          </Card>
          )
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-30">
        <div className="dock-scrim" aria-hidden="true" />
        <div className="dock-panel px-4 py-3">
          <div className="mx-auto flex max-w-lg gap-2">
            {step > 0 ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </Button>
            ) : onSkip ? (
              <Button variant="secondary" fullWidth onClick={onSkip}>
                Skip for now
              </Button>
            ) : null}
            {step < 2 ? (
              <Button
                fullWidth
                disabled={step === 1 && daysSelected === 0}
                onClick={() => setStep((current) => current + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button fullWidth loading={saving} disabled={!canSave} onClick={() => void handleFinish()}>
                Save plan
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
