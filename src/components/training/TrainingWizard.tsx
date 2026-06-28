import { useEffect, useState } from 'react'
import { Badge, Button, Card } from '@/components/ui'
import {
  DAY_LABELS,
  MESOCYCLE_MULTIPLIER,
  recommendFromWizard,
  type WizardAnswers,
} from '@/lib/training/planEngine'

const DEFAULT_ANSWERS: WizardAnswers = {
  maxCleanSet: 15,
  trainingLevel: 'beginner',
  preferredTrainingDays: [1, 2, 3, 4, 5],
  sorenessWarningAcknowledged: false,
  challengeIntensity: 'moderate',
}

type TrainingWizardProps = {
  saving?: boolean
  initialAnswers?: WizardAnswers | null
  onComplete?: (answers: WizardAnswers) => void | Promise<void>
}

function dayTypeBadgeVariant(dayType: string): 'neutral' | 'accent' | 'warning' | 'success' {
  if (dayType === 'challenge') return 'accent'
  if (dayType === 'easy') return 'success'
  if (dayType === 'moderate') return 'neutral'
  return 'neutral'
}

export function TrainingWizard({
  saving = false,
  initialAnswers = null,
  onComplete,
}: TrainingWizardProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<WizardAnswers>(initialAnswers ?? DEFAULT_ANSWERS)
  const [hydratedFromSaved, setHydratedFromSaved] = useState(initialAnswers != null)

  useEffect(() => {
    if (initialAnswers && !hydratedFromSaved) {
      setAnswers(initialAnswers)
      setHydratedFromSaved(true)
    }
  }, [initialAnswers, hydratedFromSaved])

  const recommendation = recommendFromWizard(answers)

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
    <div className="space-y-4">
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
          <div>
            <p className="text-sm font-medium text-text-primary">Max clean set</p>
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
            <Badge variant="accent">Week 1 · {Math.round(MESOCYCLE_MULTIPLIER[1] * 100)}% volume</Badge>
          </div>

          <p className="text-sm text-text-muted">{recommendation.summary}</p>

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
                  const day = recommendation.plan.weeklySchedule[index as 0 | 1 | 2 | 3 | 4 | 5 | 6]
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
              I understand soreness guidance: general fitness only, not medical advice. I will stop
              if I feel pain.
            </span>
          </label>
          <p className="text-xs text-text-muted">{recommendation.plan.disclaimer}</p>
        </Card>
      ) : null}

      <div className="flex gap-2">
        {step > 0 ? (
          <Button variant="secondary" fullWidth onClick={() => setStep((current) => current - 1)}>
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
  )
}
