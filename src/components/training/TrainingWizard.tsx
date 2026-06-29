import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card } from '@/components/ui'
import {
  DAY_LABELS,
  MESOCYCLE_MULTIPLIER,
  recommendFromWizard,
  type WizardAnswers,
} from '@/lib/training/planEngine'
import {
  derivePlanCalibration,
  hasUsableVolumeHistory,
  suggestWizardPrefill,
  type VolumeHistoryStats,
} from '@/lib/training/volumeCalibration'

const DEFAULT_ANSWERS: WizardAnswers = {
  maxCleanSet: 15,
  trainingLevel: 'beginner',
  preferredTrainingDays: [1, 2, 3, 4, 5],
  sorenessWarningAcknowledged: false,
  challengeIntensity: 'moderate',
  recentDailyAverage: null,
}

type TrainingWizardProps = {
  saving?: boolean
  initialAnswers?: WizardAnswers | null
  historyStats?: VolumeHistoryStats | null
  historyLoading?: boolean
  onComplete?: (answers: WizardAnswers) => void | Promise<void>
}

function dayTypeBadgeVariant(dayType: string): 'neutral' | 'accent' | 'warning' | 'success' {
  if (dayType === 'challenge') return 'accent'
  if (dayType === 'easy') return 'success'
  if (dayType === 'moderate') return 'neutral'
  return 'neutral'
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
  historyStats = null,
  historyLoading = false,
  onComplete,
}: TrainingWizardProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<WizardAnswers>(initialAnswers ?? DEFAULT_ANSWERS)
  const [hydratedFromSaved, setHydratedFromSaved] = useState(initialAnswers != null)
  const [prefillApplied, setPrefillApplied] = useState(false)

  useEffect(() => {
    if (initialAnswers && !hydratedFromSaved) {
      setAnswers(initialAnswers)
      setHydratedFromSaved(true)
    }
  }, [initialAnswers, hydratedFromSaved])

  useEffect(() => {
    if (initialAnswers || prefillApplied || !historyStats) {
      return
    }

    if (hasUsableVolumeHistory(historyStats)) {
      const prefill = suggestWizardPrefill(historyStats)
      setAnswers((current) => ({
        ...current,
        maxCleanSet: prefill.maxCleanSet,
        recentDailyAverage: prefill.recentDailyAverage,
      }))
      setPrefillApplied(true)
    }
  }, [historyStats, initialAnswers, prefillApplied])

  const calibration = useMemo(
    () => derivePlanCalibration(answers, historyStats),
    [answers, historyStats],
  )

  const recommendation = useMemo(
    () =>
      recommendFromWizard(answers, {
        initialBaseline: calibration.initialBaseline,
        startMesocycleWeek: calibration.startMesocycleWeek,
      }),
    [answers, calibration.initialBaseline, calibration.startMesocycleWeek],
  )

  const showHistory = hasUsableVolumeHistory(historyStats)
  const startWeek = calibration.startMesocycleWeek

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
    onComplete?.(answers)
  }

  return (
    <>
      <div className="space-y-4 pb-[calc(var(--bank-cta-height)+1rem)]">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${step >= index ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>

        {step === 0 ? (
          <Card padding="md" className="space-y-4">
            {historyLoading ? (
              <p className="text-xs text-text-muted">Loading your recent PushUS logs…</p>
            ) : null}

            {showHistory && historyStats ? (
              <div className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-3">
                <p className="text-xs font-semibold text-text-primary">
                  From your PushUS logs (last 28 days)
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
                  We use this to set a structured starting block — not to copy your challenge daily
                  total.
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-sm font-medium text-text-primary">
                Max clean set
                {showHistory ? (
                  <span className="ml-1 font-normal text-text-muted">(suggested — change if wrong)</span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                How many push-ups can you do in one go with good form?
              </p>
            </div>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={answers.maxCleanSet}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  maxCleanSet: Number(event.target.value),
                }))
              }
              className="w-full accent-accent"
            />
            <p className="text-center font-mono text-2xl font-bold text-text-primary">
              {answers.maxCleanSet}
            </p>

            <div className="space-y-2">
              <label htmlFor="recent-daily-average" className="text-sm font-medium text-text-primary">
                Recent daily average
                {showHistory ? (
                  <span className="ml-1 font-normal text-text-muted">(optional)</span>
                ) : null}
              </label>
              <p className="text-xs text-text-muted">
                Your typical total reps per day over the last few weeks. Leave blank if unsure.
              </p>
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
                  const raw = event.target.value.trim()
                  setAnswers((current) => ({
                    ...current,
                    recentDailyAverage: parseRecentDailyAverage(raw),
                  }))
                }}
                className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5 text-sm text-text-primary"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Experience level</p>
              <div className="grid grid-cols-3 gap-2">
                {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setAnswers((current) => ({ ...current, trainingLevel: level }))}
                    className={`min-h-11 rounded-[var(--radius-md)] border px-2 text-xs font-semibold capitalize ${
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
            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(index)}
                  className={`flex min-h-11 flex-col items-center justify-center rounded-[var(--radius-md)] border text-xs font-semibold ${
                    answers.preferredTrainingDays.includes(index)
                      ? 'border-accent bg-accent-muted text-accent'
                      : 'border-border bg-surface text-text-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Challenge intensity</p>
              <div className="grid grid-cols-3 gap-2">
                {(['light', 'moderate', 'intense'] as const).map((intensity) => (
                  <button
                    key={intensity}
                    type="button"
                    onClick={() =>
                      setAnswers((current) => ({ ...current, challengeIntensity: intensity }))
                    }
                    className={`min-h-11 rounded-[var(--radius-md)] border px-2 text-xs font-semibold capitalize ${
                      answers.challengeIntensity === intensity
                        ? 'border-accent bg-accent-muted text-accent'
                        : 'border-border bg-surface text-text-muted'
                    }`}
                  >
                    {intensity}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-text-primary">Your 4-week plan</p>
              <Badge variant="accent">
                Week {startWeek} · {Math.round(MESOCYCLE_MULTIPLIER[startWeek] * 100)}% volume
              </Badge>
            </div>

            <p className="text-sm text-text-muted">{recommendation.summary}</p>

            {calibration.calibrationNote ? (
              <p className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-xs text-text-primary">
                {calibration.calibrationNote}
              </p>
            ) : null}

            <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
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
                            {day.dayType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-text-primary">
                          {day.target > 0 ? (
                            <>
                              {day.target}
                              <span className="ml-1 text-text-muted">
                                ({day.sets}×{day.setSize})
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-text-muted">Peak day</dt>
                <dd className="font-mono text-lg font-bold text-text-primary">
                  {recommendation.plan.peakDayTarget}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Set size</dt>
                <dd className="font-mono text-lg font-bold text-text-primary">
                  {recommendation.plan.setSize}
                </dd>
              </div>
            </dl>

            {calibration.previewNote ? (
              <p className="text-xs italic text-text-muted">{calibration.previewNote}</p>
            ) : null}

            <p className="text-xs text-text-muted">
              Volume builds over 4 weeks: ramp in, peak, then deload. Targets adjust automatically
              each week based on your progress.
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
            <p className="text-xs text-text-muted">{recommendation.plan.disclaimer}</p>
          </Card>
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
            ) : null}
            {step < 2 ? (
              <Button fullWidth onClick={() => setStep((current) => current + 1)}>
                Continue
              </Button>
            ) : (
              <Button fullWidth loading={saving} onClick={() => void handleFinish()}>
                Save plan
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
