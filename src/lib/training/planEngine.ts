/**
 * Training plan engine — conservative defaults + draft progression formulas.
 * Draft formulas are marked FOR REVIEW; enable via `useDraftFormulas` cautiously in UI.
 */

export type TrainingPlan = {
  dailyTarget: number
  recommendedSetSize: number
  trainingDaysPerWeek: number
  restDays: number[]
  sorenessWarning: boolean
  disclaimer: string
}

export type WizardAnswers = {
  maxCleanSet: number
  trainingLevel: 'beginner' | 'intermediate' | 'advanced'
  preferredTrainingDays: number[]
  sorenessWarningAcknowledged: boolean
  challengeIntensity: 'light' | 'moderate' | 'intense'
}

export type PlanRecommendation = {
  plan: TrainingPlan
  summary: string
  isPlaceholder: boolean
}

export type RecommendOptions = {
  /** When true, uses draft formulas (FOR REVIEW — not clinically validated). */
  useDraftFormulas?: boolean
}

/** Set to true only after product review sign-off. UI should pass useDraftFormulas explicitly. */
export const DRAFT_FORMULAS_ENABLED = false

const DEFAULT_DISCLAIMER =
  'General fitness guidance only — not medical advice. Stop if you feel pain.'

const CONSERVATIVE_DEFAULTS = {
  dailyTarget: 20,
  recommendedSetSize: 10,
  trainingDaysPerWeek: 4,
  restDays: [0, 6] as number[],
  sorenessWarning: true,
} as const

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const

const LEVEL_MULTIPLIER: Record<WizardAnswers['trainingLevel'], number> = {
  beginner: 0.6,
  intermediate: 0.85,
  advanced: 1.0,
}

const INTENSITY_MULTIPLIER: Record<WizardAnswers['challengeIntensity'], number> = {
  light: 0.8,
  moderate: 1.0,
  intense: 1.2,
}

export function getDefaultPlan(): TrainingPlan {
  return {
    ...CONSERVATIVE_DEFAULTS,
    disclaimer: DEFAULT_DISCLAIMER,
  }
}

function deriveRestDays(preferredTrainingDays: number[]): number[] {
  const preferred = new Set(preferredTrainingDays)
  return ALL_DAYS.filter((day) => !preferred.has(day))
}

function roundToNearestFive(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5)
}

/**
 * FOR REVIEW — draft progression from wizard answers.
 * Do not enable in production without Rhys / ChatGPT review sign-off.
 */
export function recommendFromWizardDraft(answers: WizardAnswers): PlanRecommendation {
  const levelMultiplier = LEVEL_MULTIPLIER[answers.trainingLevel]
  const intensityMultiplier = INTENSITY_MULTIPLIER[answers.challengeIntensity]
  const trainingDays = answers.preferredTrainingDays.length || 4

  const dailyTarget = roundToNearestFive(
    answers.maxCleanSet * levelMultiplier * intensityMultiplier * 0.75,
  )

  const recommendedSetSize = roundToNearestFive(
    Math.min(answers.maxCleanSet, answers.maxCleanSet * 0.5),
  )

  const restDays = deriveRestDays(answers.preferredTrainingDays)

  const plan: TrainingPlan = {
    dailyTarget,
    recommendedSetSize,
    trainingDaysPerWeek: trainingDays,
    restDays: restDays.length > 0 ? restDays : [0, 6],
    sorenessWarning: !answers.sorenessWarningAcknowledged,
    disclaimer: DEFAULT_DISCLAIMER,
  }

  return {
    plan,
    summary: `Draft plan (FOR REVIEW): ${dailyTarget} reps/day in sets of ${recommendedSetSize}, ${trainingDays} training days per week.`,
    isPlaceholder: false,
  }
}

/** Returns conservative static defaults unless draft formulas are explicitly requested. */
export function recommendFromWizard(
  answers: WizardAnswers,
  options: RecommendOptions = {},
): PlanRecommendation {
  const useDraft = options.useDraftFormulas ?? DRAFT_FORMULAS_ENABLED

  if (useDraft) {
    return recommendFromWizardDraft(answers)
  }

  return {
    plan: getDefaultPlan(),
    summary:
      'Conservative starter plan: 20 reps per day in sets of 10, with rest on weekends.',
    isPlaceholder: true,
  }
}

/** Estimate weekly volume from a plan (FOR REVIEW). */
export function estimateWeeklyVolume(plan: TrainingPlan): number {
  return plan.dailyTarget * plan.trainingDaysPerWeek
}

/** Suggested daily target adjustment after a week (FOR REVIEW — hold / increase / reduce). */
export type ProgressionDecision = 'hold' | 'increase' | 'reduce'

export function suggestProgression(
  currentPlan: TrainingPlan,
  daysGoalMet: number,
  daysLogged: number,
): { decision: ProgressionDecision; nextDailyTarget: number; rationale: string } {
  const hitRate = daysLogged > 0 ? daysGoalMet / daysLogged : 0

  if (hitRate >= 0.85) {
    const next = roundToNearestFive(currentPlan.dailyTarget * 1.1)
    return {
      decision: 'increase',
      nextDailyTarget: next,
      rationale: 'FOR REVIEW: high goal completion — modest 10% increase suggested.',
    }
  }

  if (hitRate < 0.5) {
    const next = roundToNearestFive(currentPlan.dailyTarget * 0.85)
    return {
      decision: 'reduce',
      nextDailyTarget: Math.max(10, next),
      rationale: 'FOR REVIEW: low goal completion — 15% reduction suggested.',
    }
  }

  return {
    decision: 'hold',
    nextDailyTarget: currentPlan.dailyTarget,
    rationale: 'FOR REVIEW: steady progress — hold current target.',
  }
}
