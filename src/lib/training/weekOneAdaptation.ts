import {
  effortSummarySince,
  observedSetMax,
  type DailyGoalLog,
  type EffortEntry,
  type EffortSummary,
} from '@/lib/training/effortFeedback'
import {
  rebuildScheduleForMesocycleWeek,
  type MesocycleWeek,
  type TrainingPlan,
  type WizardAnswers,
} from '@/lib/training/planEngine'
import { MAX_HINT_BASELINE } from '@/lib/training/volumeCalibration'

export const WEEK_ONE_ADAPTATION_DAYS = 7
export const WEEK_ONE_MIN_LOGGED_DAYS = 2
export const WEEK_ONE_INCREASE_FACTOR = 1.03
export const WEEK_ONE_DECREASE_FACTOR = 0.95
export const WEEK_ONE_MAX_INCREASE = 1.12
export const WEEK_ONE_MAX_DECREASE = 0.9

export type WeekOneAdaptationResult = {
  plan: TrainingPlan
  adapted: boolean
  progressionNote: string | null
}

function daysSince(startIso: string, todayIso: string): number {
  const start = new Date(`${startIso}T12:00:00Z`)
  const today = new Date(`${todayIso}T12:00:00Z`)
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000))
}

function roundBaseline(value: number): number {
  return Math.round(value * 100) / 100
}

function countLoggedTrainingDays(dailyLogs: DailyGoalLog[]): number {
  return dailyLogs.filter(
    (log) => !log.isRestDay && log.target > 0 && log.banked > 0,
  ).length
}

function hitRateOnLoggedDays(dailyLogs: DailyGoalLog[]): number {
  const loggedTrainingDays = dailyLogs.filter(
    (log) => !log.isRestDay && log.target > 0 && log.banked > 0,
  )

  if (loggedTrainingDays.length === 0) {
    return 0
  }

  const goalMetDays = loggedTrainingDays.filter((log) => log.banked >= log.target).length
  return goalMetDays / loggedTrainingDays.length
}

function hasMissedTargets(dailyLogs: DailyGoalLog[]): boolean {
  return dailyLogs.some(
    (log) => !log.isRestDay && log.target > 0 && log.banked > 0 && log.banked < log.target,
  )
}

export function deriveWeekOneBaselineAdjustment(
  plan: TrainingPlan,
  answers: WizardAnswers,
  dailyLogs: DailyGoalLog[],
  effortSummary: EffortSummary,
  mesocycleStartedAt: string,
  todayIso: string,
  weekOneLastAdjustedAt?: string | null,
): WeekOneAdaptationResult {
  const daysInBlock = daysSince(mesocycleStartedAt, todayIso)

  if (weekOneLastAdjustedAt === todayIso) {
    return { plan, adapted: false, progressionNote: null }
  }

  if (daysInBlock >= WEEK_ONE_ADAPTATION_DAYS) {
    return { plan, adapted: false, progressionNote: null }
  }

  const loggedTrainingDays = countLoggedTrainingDays(dailyLogs)
  if (loggedTrainingDays < WEEK_ONE_MIN_LOGGED_DAYS) {
    return { plan, adapted: false, progressionNote: null }
  }

  const hitRate = hitRateOnLoggedDays(dailyLogs)
  let nextBaseline = plan.planBaseline
  let progressionNote: string | null = null

  const canIncrease =
    hitRate >= 0.85 &&
    (effortSummary.medianRir !== null && effortSummary.sampleCount >= 2
      ? effortSummary.medianRir >= 2
      : effortSummary.observedMax !== null &&
        effortSummary.observedMax >= answers.maxCleanSet + 1)

  const canDecrease =
    hitRate < 0.5 ||
    (effortSummary.zeroRirRate >= 0.5 && hasMissedTargets(dailyLogs))

  if (canIncrease) {
    const maxAllowed = Math.min(
      MAX_HINT_BASELINE,
      roundBaseline(plan.planBaseline * WEEK_ONE_MAX_INCREASE),
    )
    nextBaseline = roundBaseline(
      Math.min(plan.planBaseline * WEEK_ONE_INCREASE_FACTOR, maxAllowed),
    )
    if (nextBaseline > plan.planBaseline) {
      progressionNote =
        'Week 1 tuning — targets adjusted up from your last few sessions.'
    }
  } else if (canDecrease) {
    const minAllowed = roundBaseline(plan.planBaseline * WEEK_ONE_MAX_DECREASE)
    nextBaseline = roundBaseline(
      Math.max(plan.planBaseline * WEEK_ONE_DECREASE_FACTOR, minAllowed),
    )
    if (nextBaseline < plan.planBaseline) {
      progressionNote =
        'Week 1 tuning — targets eased slightly from your last few sessions.'
    }
  }

  if (nextBaseline === plan.planBaseline) {
    return { plan, adapted: false, progressionNote: null }
  }

  const mesocycleWeek = plan.mesocycleWeek as MesocycleWeek
  const updatedPlan = rebuildScheduleForMesocycleWeek(
    { ...plan, planBaseline: nextBaseline },
    answers,
    mesocycleWeek,
  )

  return {
    plan: { ...updatedPlan, planBaseline: nextBaseline },
    adapted: true,
    progressionNote,
  }
}

export function filterEffortSincePlanStart(
  entries: EffortEntry[],
  mesocycleStartedAt: string,
): EffortEntry[] {
  return entries.filter((entry) => entry.logged_for >= mesocycleStartedAt)
}

export { effortSummarySince, observedSetMax, daysSince }
