import { useState } from 'react'
import { Badge, Button, Card } from '@/components/ui'
import {
  DRAFT_FORMULAS_ENABLED,
  recommendFromWizard,
  type WizardAnswers,
} from '@/lib/training/planEngine'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEFAULT_ANSWERS: WizardAnswers = {
  maxCleanSet: 15,
  trainingLevel: 'beginner',
  preferredTrainingDays: [1, 2, 3, 4, 5],
  sorenessWarningAcknowledged: false,
  challengeIntensity: 'moderate',
}

type TrainingWizardProps = {
  onComplete?: (answers: WizardAnswers) => void
}

export function TrainingWizard({ onComplete }: TrainingWizardProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<WizardAnswers>(DEFAULT_ANSWERS)

  const recommendation = recommendFromWizard(answers, {
    useDraftFormulas: DRAFT_FORMULAS_ENABLED,
  })

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
            <p className="mt-1 text-xs text-text-muted">Pick the days you want to train.</p>
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
            <p className="text-sm font-medium text-text-primary">Recommended plan</p>
            {recommendation.isPlaceholder ? (
              <Badge variant="warning">Conservative default</Badge>
            ) : (
              <Badge variant="accent">Draft — for review</Badge>
            )}
          </div>
          <p className="text-sm text-text-muted">{recommendation.summary}</p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-text-muted">Daily target</dt>
              <dd className="font-mono text-lg font-bold text-text-primary">
                {recommendation.plan.dailyTarget}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Set size</dt>
              <dd className="font-mono text-lg font-bold text-text-primary">
                {recommendation.plan.recommendedSetSize}
              </dd>
            </div>
          </dl>
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
          <Button fullWidth onClick={handleFinish}>
            Save plan (stub)
          </Button>
        )}
      </div>
    </div>
  )
}
