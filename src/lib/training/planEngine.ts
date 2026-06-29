/**
 * Science-based training plan engine — weekly microcycle + 4-week mesocycle.
 * Submaximal sets, tiered rest/easy/moderate/challenge days, progressive volume.
 */

import {
  deriveProgressionFromEffort,
  type EffortSummary,
} from '@/lib/training/effortFeedback'
import {
  buildTrustedDayPrescription,
  parseCalibrationNote,
  volumeContextFromStoredPlan,
  type VolumeCalibrationContext,
} from '@/lib/training/trustedVolume'
import type { VolumeHistoryStats } from '@/lib/training/volumeCalibration'

export type DayType = 'rest' | 'easy' | 'moderate' | 'challenge'

export type DayPrescription = {
  dayType: DayType
  target: number
  setSize: number
  sets: number
  label: string
}

export type WeeklySchedule = Record<0 | 1 | 2 | 3 | 4 | 5 | 6, DayPrescription>

export type MesocycleWeek = 1 | 2 | 3 | 4

export type TrainingPlan = {
  weeklySchedule: WeeklySchedule
  setSize: number
  planMaxClean: number
  mesocycleWeek: MesocycleWeek
  mesocycleStartedAt: string
  mesocycleBlockStartWeek: MesocycleWeek
  planBaseline: number
  restDays: number[]
  easyDays: number[]
  challengeDays: number[]
  peakDayTarget: number
  trainingDaysPerWeek: number
  sorenessWarning: boolean
  disclaimer: string
  /** @deprecated Use peakDayTarget or getTodayPrescription().target */
  dailyTarget: number
  /** @deprecated Use setSize */
  recommendedSetSize: number
}

export type WizardAnswers = {
  maxCleanSet: number
  trainingLevel: 'beginner' | 'intermediate' | 'advanced'
  preferredTrainingDays: number[]
  sorenessWarningAcknowledged: boolean
  wizardSorenessLevel?: 'none' | 'mild' | 'notable'
  challengeIntensity: 'light' | 'moderate' | 'intense'
  recentDailyAverage?: number | null
  /** Populated when loading from DB — holds encoded volume trust metadata. */
  storedCalibrationNote?: string | null
  /** Set when user confirms off-app training on stale path — encoded in calibration_note at save. */
  manualConfirmedRegularTraining?: boolean
}

export type RecommendWizardOptions = {
  initialBaseline?: number
  startMesocycleWeek?: MesocycleWeek
  mesocycleStartedAt?: string
  volumeContext?: VolumeCalibrationContext
}

export type PlanRecommendation = {
  plan: TrainingPlan
  summary: string
  isPlaceholder: boolean
  calibrationNote?: string | null
  previewNote?: string | null
}

export type TodayPrescription = DayPrescription & {
  isRestDay: boolean
  mesocycleWeek: MesocycleWeek
  suggestMaxCheckIn: boolean
  safetyNote: string | null
  dayTypeLabel: string
}

export type MesocycleAdvanceResult = {
  plan: TrainingPlan
  advanced: boolean
  progressionNote: string | null
  maxCleanSet: number
}

const DEFAULT_DISCLAIMER =
  'General fitness guidance only — not medical advice. Stop if you feel pain.'

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const MESOCYCLE_MULTIPLIER: Record<MesocycleWeek, number> = {
  1: 0.7,
  2: 0.85,
  3: 1.0,
  4: 0.55,
}

/** Default active days: Mon, Tue, Wed, Fri, Sat — Thu + Sun rest. */
export const DEFAULT_PREFERRED_TRAINING_DAYS = [1, 2, 3, 5, 6] as const

const EFFORT_RATIO: Record<DayType, number> = {
  rest: 0,
  easy: 0.35,
  moderate: 0.5,
  challenge: 0.6,
}

const LOW_CAPACITY_GENTLE_COPY =
  'Keep these tiny and easy. Rest longer. Stop if form breaks.'

/** @deprecated Draft formulas removed — kept for test compatibility */
export const DRAFT_FORMULAS_ENABLED = false

export type RecommendOptions = {
  useDraftFormulas?: boolean
}

export type ProgressionDecision = 'hold' | 'increase' | 'reduce'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundReps(value: number): number {
  return Math.max(0, Math.round(value))
}

export function minSetSize(maxCleanSet: number): number {
  if (maxCleanSet <= 3) return 1
  return 2
}

export function computeSetSizeForDay(maxCleanSet: number, dayType: DayType): number {
  if (dayType === 'rest') return 0
  const raw = Math.round(maxCleanSet * EFFORT_RATIO[dayType])
  const floor = minSetSize(maxCleanSet)
  const ceiling = Math.min(15, Math.max(1, maxCleanSet - 1))
  return clamp(raw, floor, ceiling)
}

/** Representative set size (moderate day) — used for plan summary fields. */
export function computeSetSize(maxCleanSet: number): number {
  return computeSetSizeForDay(maxCleanSet, 'moderate')
}

export function isLowCapacityPlan(maxCleanSet: number): boolean {
  return maxCleanSet <= 2
}

export function getDayTypeDisplayLabel(
  dayType: DayType,
  maxCleanSet: number,
): string {
  if (dayType === 'rest') return 'Rest'
  if (
    isLowCapacityPlan(maxCleanSet) &&
    (dayType === 'moderate' || dayType === 'challenge')
  ) {
    return 'Practice'
  }
  return dayType.charAt(0).toUpperCase() + dayType.slice(1)
}

export function applyVolumeCapCoherent(
  target: number,
  sets: number,
  setSize: number,
  cap: number,
  maxCleanSet: number,
): { target: number; sets: number; setSize: number } {
  if (target <= cap) {
    return { target, sets, setSize }
  }

  const newSets = Math.max(1, Math.floor(cap / setSize))
  if (newSets * setSize <= cap) {
    return { target: newSets * setSize, sets: newSets, setSize }
  }

  const newSize = Math.max(minSetSize(maxCleanSet), Math.floor(cap / sets))
  return {
    target: Math.min(cap, sets * newSize),
    sets,
    setSize: newSize,
  }
}

export function dailyVolumeCap(maxCleanSet: number): number {
  return Math.min(maxCleanSet * 2, maxCleanSet + 15)
}

function dayTypeLabel(dayType: DayType, sets: number, setSize: number): string {
  if (dayType === 'rest') return 'Rest — recovery'
  const typeName = dayType.charAt(0).toUpperCase() + dayType.slice(1)
  return `${typeName} — ${sets} sets of ${setSize}`
}

function assignDayTypes(
  trainingDays: number[],
  trainingLevel: WizardAnswers['trainingLevel'],
): Map<number, DayType> {
  const sorted = [...trainingDays].sort((a, b) => a - b)
  const assignment = new Map<number, DayType>()

  if (sorted.length === 0) {
    return assignment
  }

  const patterns: Record<number, DayType[]> = {
    1: ['moderate'],
    2: ['easy', 'challenge'],
    3: ['easy', 'moderate', 'challenge'],
    4: ['easy', 'moderate', 'moderate', 'challenge'],
    5: ['easy', 'easy', 'moderate', 'easy', 'challenge'],
    6: ['easy', 'easy', 'moderate', 'moderate', 'challenge', 'moderate'],
    7: ['easy', 'moderate', 'easy', 'moderate', 'challenge', 'moderate', 'easy'],
  }

  let pattern = patterns[Math.min(sorted.length, 7)] ?? patterns[4]

  if (trainingLevel === 'beginner' && sorted.length > 5) {
    pattern = patterns[5]
    sorted.splice(5)
  }

  sorted.forEach((day, index) => {
    assignment.set(day, pattern[index] ?? 'moderate')
  })

  return assignment
}

function enforceChallengeSpacing(assignment: Map<number, DayType>): void {
  const trainingDays = [...assignment.keys()].sort((a, b) => a - b)

  for (let i = 0; i < trainingDays.length; i++) {
    const day = trainingDays[i]
    if (assignment.get(day) !== 'challenge') continue

    if (i > 0) {
      const prev = trainingDays[i - 1]
      const prevType = assignment.get(prev)
      if (prevType === 'challenge' || prevType === 'moderate') {
        assignment.set(prev, 'easy')
      }
    }
  }
}

export function buildWeeklySchedule(
  answers: WizardAnswers,
  mesocycleWeek: MesocycleWeek = 3,
  planBaseline = 1,
  volumeContext?: VolumeCalibrationContext,
): WeeklySchedule {
  const ctx = volumeContext ?? volumeContextFromStoredPlan(answers, answers.storedCalibrationNote)

  let trainingDays = [...answers.preferredTrainingDays].sort((a, b) => a - b)

  if (trainingDays.length === 0) {
    trainingDays = [...DEFAULT_PREFERRED_TRAINING_DAYS]
  }

  if (answers.trainingLevel === 'beginner') {
    const maxTrainingDays = 5
    if (trainingDays.length > maxTrainingDays) {
      trainingDays = trainingDays.slice(0, maxTrainingDays)
    }
  }

  const assignment = assignDayTypes(trainingDays, answers.trainingLevel)
  enforceChallengeSpacing(assignment)

  const schedule = {} as WeeklySchedule

  for (const day of ALL_DAYS) {
    const dayType = assignment.get(day) ?? 'rest'
    const prescription = buildTrustedDayPrescription(
      answers,
      dayType,
      mesocycleWeek,
      planBaseline,
      ctx,
    )

    schedule[day] = {
      dayType,
      target: prescription.target,
      setSize: prescription.setSize,
      sets: prescription.sets,
      label: dayTypeLabel(dayType, prescription.sets, prescription.setSize),
    }
  }

  return schedule
}

export function deriveDayLists(schedule: WeeklySchedule): {
  restDays: number[]
  easyDays: number[]
  challengeDays: number[]
} {
  const restDays: number[] = []
  const easyDays: number[] = []
  const challengeDays: number[] = []

  for (const day of ALL_DAYS) {
    const prescription = schedule[day]
    if (prescription.dayType === 'rest') restDays.push(day)
    if (prescription.dayType === 'easy') easyDays.push(day)
    if (prescription.dayType === 'challenge') challengeDays.push(day)
  }

  return { restDays, easyDays, challengeDays }
}

export function getPeakDayTarget(schedule: WeeklySchedule): number {
  return Math.max(0, ...ALL_DAYS.map((day) => schedule[day].target))
}

export function trainingDaysCount(schedule: WeeklySchedule): number {
  return ALL_DAYS.filter((day) => schedule[day].dayType !== 'rest').length
}

function planFromAnswers(
  answers: WizardAnswers,
  mesocycleWeek: MesocycleWeek = 1,
  mesocycleStartedAt?: string,
  planBaseline = 1,
  mesocycleBlockStartWeek: MesocycleWeek = mesocycleWeek,
  volumeContext?: VolumeCalibrationContext,
): TrainingPlan {
  const weeklySchedule = buildWeeklySchedule(
    answers,
    mesocycleWeek,
    planBaseline,
    volumeContext,
  )
  const { restDays, easyDays, challengeDays } = deriveDayLists(weeklySchedule)
  const setSize = computeSetSize(answers.maxCleanSet)
  const peakDayTarget = getPeakDayTarget(weeklySchedule)
  const trainingDaysPerWeek = trainingDaysCount(weeklySchedule)

  return {
    weeklySchedule,
    setSize,
    planMaxClean: answers.maxCleanSet,
    mesocycleWeek,
    mesocycleStartedAt: mesocycleStartedAt ?? todayIsoDate(),
    mesocycleBlockStartWeek,
    planBaseline,
    restDays,
    easyDays,
    challengeDays,
    peakDayTarget,
    trainingDaysPerWeek,
    sorenessWarning: !answers.sorenessWarningAcknowledged,
    disclaimer: DEFAULT_DISCLAIMER,
    dailyTarget: peakDayTarget,
    recommendedSetSize: setSize,
  }
}

export function todayIsoDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function dayOfWeekFromIso(date: string, timezone = 'UTC'): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  })
  const weekday = formatter.format(new Date(`${date}T12:00:00Z`))
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  return index >= 0 ? index : new Date(`${date}T12:00:00Z`).getUTCDay()
}

export function getCurrentMesocycleWeek(
  mesocycleStartedAt: string,
  today: string,
): MesocycleWeek {
  const start = new Date(`${mesocycleStartedAt}T12:00:00Z`)
  const current = new Date(`${today}T12:00:00Z`)
  const days = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000))
  const weekIndex = Math.floor(days / 7) % 4
  return (weekIndex + 1) as MesocycleWeek
}

/** Week within the current block when the block may start above week 1 (calibration). */
export function getMesocycleWeekInBlock(
  mesocycleStartedAt: string,
  today: string,
  blockStartWeek: MesocycleWeek = 1,
): MesocycleWeek {
  const start = new Date(`${mesocycleStartedAt}T12:00:00Z`)
  const current = new Date(`${today}T12:00:00Z`)
  const days = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000))
  const weeksElapsed = Math.floor(days / 7)
  return (((blockStartWeek - 1 + weeksElapsed) % 4) + 1) as MesocycleWeek
}

export type MaxCheckInContext = {
  sorenessStatus?: 'good' | 'bit_sore' | 'pain_stop' | null
  hitRate7d?: number
  effortHardRate7d?: number
  daysSinceLastMaxCheckIn?: number | null
  recentHardWeek?: boolean
}

export function suggestMaxCheckIn(
  dayType: DayType,
  maxCleanSet: number,
  ctx: MaxCheckInContext = {},
): boolean {
  if (dayType !== 'challenge') return false
  if (isLowCapacityPlan(maxCleanSet)) return false
  if (ctx.sorenessStatus && ctx.sorenessStatus !== 'good') return false
  if (ctx.recentHardWeek) return false
  if ((ctx.hitRate7d ?? 1) < 0.7) return false
  if ((ctx.effortHardRate7d ?? 0) > 0.4) return false
  if (ctx.daysSinceLastMaxCheckIn != null && ctx.daysSinceLastMaxCheckIn < 14) {
    return false
  }
  return true
}

export function getTodayPrescription(
  plan: TrainingPlan,
  date: string,
  timezone = 'UTC',
  checkInContext?: MaxCheckInContext,
): TodayPrescription {
  const dayOfWeek = dayOfWeekFromIso(date, timezone) as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const prescription = plan.weeklySchedule[dayOfWeek]
  const maxClean = plan.planMaxClean
  const isRestDay = prescription.dayType === 'rest' || prescription.target === 0

  return {
    ...prescription,
    isRestDay,
    mesocycleWeek: plan.mesocycleWeek,
    suggestMaxCheckIn:
      !isRestDay && suggestMaxCheckIn(prescription.dayType, maxClean, checkInContext),
    safetyNote: isLowCapacityPlan(maxClean) && !isRestDay ? LOW_CAPACITY_GENTLE_COPY : null,
    dayTypeLabel: getDayTypeDisplayLabel(prescription.dayType, maxClean),
  }
}

export function rebuildScheduleForMesocycleWeek(
  plan: TrainingPlan,
  answers: WizardAnswers,
  mesocycleWeek: MesocycleWeek,
): TrainingPlan {
  const weeklySchedule = buildWeeklySchedule(
    answers,
    mesocycleWeek,
    plan.planBaseline,
    volumeContextFromStoredPlan(answers, answers.storedCalibrationNote),
  )
  const { restDays, easyDays, challengeDays } = deriveDayLists(weeklySchedule)
  const peakDayTarget = getPeakDayTarget(weeklySchedule)

  return {
    ...plan,
    weeklySchedule,
    mesocycleWeek,
    restDays,
    easyDays,
    challengeDays,
    peakDayTarget,
    trainingDaysPerWeek: trainingDaysCount(weeklySchedule),
    dailyTarget: peakDayTarget,
  }
}

export function advanceMesocycleIfDue(
  plan: TrainingPlan,
  answers: WizardAnswers,
  today: string,
  hitRate: number,
  effortSummary?: EffortSummary | null,
  _weekEffortSummary?: EffortSummary | null,
): MesocycleAdvanceResult {
  let nextAnswers = { ...answers }
  let maxCleanSet = answers.maxCleanSet

  if (plan.mesocycleStartedAt > today) {
    return { plan, advanced: false, progressionNote: null, maxCleanSet }
  }

  const start = new Date(`${plan.mesocycleStartedAt}T12:00:00Z`)
  const current = new Date(`${today}T12:00:00Z`)
  const daysElapsed = Math.floor((current.getTime() - start.getTime()) / 86_400_000)
  const completedWeeks = Math.floor(daysElapsed / 7)

  if (completedWeeks < 1) {
    const currentWeek = getMesocycleWeekInBlock(
      plan.mesocycleStartedAt,
      today,
      plan.mesocycleBlockStartWeek,
    )
    if (currentWeek === plan.mesocycleWeek) {
      return { plan, advanced: false, progressionNote: null, maxCleanSet }
    }
    if (currentWeek < plan.mesocycleWeek) {
      return { plan, advanced: false, progressionNote: null, maxCleanSet }
    }
    const updated = rebuildScheduleForMesocycleWeek(plan, nextAnswers, currentWeek)
    return { plan: updated, advanced: true, progressionNote: null, maxCleanSet }
  }

  let planBaseline = plan.planBaseline
  let progressionNote: string | null = null

  if (completedWeeks >= 4) {
    const decision = deriveProgressionFromEffort(
      effortSummary ?? {
        sampleCount: 0,
        observedMax: null,
        medianRir: null,
        zeroRirRate: 0,
        highRirRate: 0,
        hardRate: 0,
      },
      answers.maxCleanSet,
      hitRate,
    )

    if (decision === 'increase') {
      planBaseline = Math.round(planBaseline * 1.05 * 100) / 100
      progressionNote =
        effortSummary && effortSummary.sampleCount >= 3
          ? 'Last block felt manageable — nudging volume up slightly.'
          : 'Strong month — volume increased 5% for the next block.'
    } else if (decision === 'reduce') {
      planBaseline = Math.round(planBaseline * 0.95 * 100) / 100
      progressionNote = 'Last block looked tough — easing off slightly.'
    } else if (hitRate < 0.5) {
      progressionNote = 'Tough month — holding current volume for the next block.'
    } else {
      progressionNote = 'Steady progress — starting a fresh 4-week build at the same level.'
    }

    const newStart = new Date(current)
    newStart.setUTCDate(newStart.getUTCDate() - (daysElapsed % 7))

    const refreshed = planFromAnswers(
      nextAnswers,
      1,
      newStart.toISOString().slice(0, 10),
      planBaseline,
    )
    return {
      plan: { ...refreshed, planBaseline },
      advanced: true,
      progressionNote,
      maxCleanSet,
    }
  }

  const currentWeek = getMesocycleWeekInBlock(
    plan.mesocycleStartedAt,
    today,
    plan.mesocycleBlockStartWeek,
  )
  if (currentWeek === plan.mesocycleWeek) {
    return { plan, advanced: false, progressionNote: null, maxCleanSet }
  }
  if (currentWeek < plan.mesocycleWeek) {
    return { plan, advanced: false, progressionNote: null, maxCleanSet }
  }

  const updated = rebuildScheduleForMesocycleWeek(plan, nextAnswers, currentWeek)
  return {
    plan: updated,
    advanced: true,
    progressionNote,
    maxCleanSet,
  }
}

function targetMatchesNominalVolume(target: number, sets: number, setSize: number): boolean {
  if (sets <= 0 || setSize <= 0) {
    return true
  }

  const nominal = sets * setSize
  return Math.abs(target - nominal) <= 1 || target >= nominal * 0.95
}

/** Human-readable day target — avoids implying sets×setSize when mesocycle scaling reduced volume. */
export function formatDayTarget(
  prescription: Pick<DayPrescription, 'target' | 'sets' | 'setSize'>,
): string {
  const { target, sets, setSize } = prescription

  if (target <= 0) {
    return '—'
  }

  if (sets <= 0) {
    return String(target)
  }

  if (targetMatchesNominalVolume(target, sets, setSize)) {
    const perSet = Math.round(target / sets)
    return `${target} (${sets}×${perSet})`
  }

  const perSet = Math.max(1, Math.round(target / sets))
  return `${target} total · ~${perSet}/set (up to ${setSize})`
}

/** Settings / log copy for set structure below the daily target number. */
export function formatDayTargetSetsDetail(
  prescription: Pick<DayPrescription, 'target' | 'sets' | 'setSize'>,
): string {
  const { target, sets, setSize } = prescription

  if (sets <= 0 || target <= 0) {
    return ''
  }

  if (targetMatchesNominalVolume(target, sets, setSize)) {
    return `${sets} sets of ${setSize}`
  }

  const perSet = Math.max(1, Math.round(target / sets))
  return `${sets} sets · ~${perSet} each (up to ${setSize} per set)`
}

export function formatWeeklyScheduleSummary(schedule: WeeklySchedule): string {
  return ALL_DAYS.map((day) => {
    const rx = schedule[day]
    if (rx.dayType === 'rest') {
      return `${DAY_LABELS[day]}: Rest`
    }
    return `${DAY_LABELS[day]}: ${formatDayTarget(rx)}`
  }).join(' · ')
}

export function recommendFromWizard(
  answers: WizardAnswers,
  options: RecommendWizardOptions = {},
): PlanRecommendation {
  const startWeek = options.startMesocycleWeek ?? 1
  const baseline = options.initialBaseline ?? 1
  const volumeContext =
    options.volumeContext ?? volumeContextFromStoredPlan(answers, answers.storedCalibrationNote)

  const plan = planFromAnswers(
    answers,
    startWeek,
    options.mesocycleStartedAt ?? todayIsoDate(),
    baseline,
    startWeek,
    volumeContext,
  )

  const summary = [
    `4-week build starting at ${Math.round(MESOCYCLE_MULTIPLIER[startWeek] * 100)}% volume.`,
    `Peak day: ${plan.peakDayTarget} reps in submaximal sets of ${plan.setSize}.`,
    formatWeeklyScheduleSummary(plan.weeklySchedule),
  ].join(' ')

  return {
    plan,
    summary,
    isPlaceholder: false,
  }
}

export function getDefaultPlan(): TrainingPlan {
  return planFromAnswers(
    {
      maxCleanSet: 15,
      trainingLevel: 'beginner',
      preferredTrainingDays: [...DEFAULT_PREFERRED_TRAINING_DAYS],
      sorenessWarningAcknowledged: false,
      challengeIntensity: 'moderate',
    },
    1,
  )
}

export function wizardAnswersFromPlanRow(row: {
  max_clean_set: number
  training_level: string
  challenge_intensity: string
  preferred_training_days: number[]
  recent_daily_average?: number | null
  calibration_note?: string | null
  wizard_soreness_level?: string | null
}): WizardAnswers {
  const level = row.training_level as WizardAnswers['trainingLevel']
  const intensity = row.challenge_intensity as WizardAnswers['challengeIntensity']
  const soreness = row.wizard_soreness_level
  const manualConfirmed = parseCalibrationNote(row.calibration_note).manualConfirmed

  return {
    maxCleanSet: row.max_clean_set,
    trainingLevel: ['beginner', 'intermediate', 'advanced'].includes(level)
      ? level
      : 'beginner',
    preferredTrainingDays: row.preferred_training_days ?? [...DEFAULT_PREFERRED_TRAINING_DAYS],
    sorenessWarningAcknowledged: true,
    challengeIntensity: ['light', 'moderate', 'intense'].includes(intensity)
      ? intensity
      : 'moderate',
    recentDailyAverage: row.recent_daily_average ?? null,
    storedCalibrationNote: row.calibration_note ?? null,
    manualConfirmedRegularTraining: manualConfirmed,
    wizardSorenessLevel:
      soreness === 'none' || soreness === 'mild' || soreness === 'notable'
        ? soreness
        : 'none',
  }
}

export function planFromRow(row: {
  max_clean_set: number
  training_level: string
  challenge_intensity: string
  preferred_training_days: number[]
  weekly_schedule?: WeeklySchedule | null
  mesocycle_week?: number | null
  mesocycle_started_at?: string | null
  mesocycle_block_start_week?: number | null
  plan_baseline?: number | null
  recent_daily_average?: number | null
  calibration_note?: string | null
  wizard_soreness_level?: string | null
}, today: string = todayIsoDate(), stats?: VolumeHistoryStats | null): TrainingPlan {
  const answers = wizardAnswersFromPlanRow(row)
  const volumeContext = volumeContextFromStoredPlan(answers, row.calibration_note, stats)
  const mesocycleStartedAt = row.mesocycle_started_at ?? today
  const planBaseline = row.plan_baseline ?? 1
  const blockStartWeek = Math.min(
    4,
    Math.max(1, row.mesocycle_block_start_week ?? 1),
  ) as MesocycleWeek
  const mesocycleWeek = getMesocycleWeekInBlock(mesocycleStartedAt, today, blockStartWeek)

  return planFromAnswers(
    answers,
    mesocycleWeek,
    mesocycleStartedAt,
    planBaseline,
    blockStartWeek,
    volumeContext,
  )
}

/** Estimate weekly volume from a plan. */
export function estimateWeeklyVolume(plan: TrainingPlan): number {
  let total = 0
  for (const day of ALL_DAYS) {
    total += plan.weeklySchedule[day].target
  }
  return total
}

/** @deprecated Use recommendFromWizard — kept for legacy tests */
export function recommendFromWizardConservative(answers: WizardAnswers): PlanRecommendation {
  return recommendFromWizard(answers)
}

/** @deprecated Draft formulas removed */
export function recommendFromWizardDraft(answers: WizardAnswers): PlanRecommendation {
  return recommendFromWizard(answers)
}

/** @deprecated Use advanceMesocycleIfDue */
export function suggestProgression(
  currentPlan: TrainingPlan,
  daysGoalMet: number,
  daysLogged: number,
): { decision: ProgressionDecision; nextDailyTarget: number; rationale: string } {
  const hitRate = daysLogged > 0 ? daysGoalMet / daysLogged : 0

  if (hitRate >= 0.85) {
    return {
      decision: 'increase',
      nextDailyTarget: roundReps(currentPlan.peakDayTarget * 1.1),
      rationale: 'High goal completion — modest increase suggested.',
    }
  }

  if (hitRate < 0.5) {
    return {
      decision: 'reduce',
      nextDailyTarget: Math.max(10, roundReps(currentPlan.peakDayTarget * 0.85)),
      rationale: 'Low goal completion — volume reduction suggested.',
    }
  }

  return {
    decision: 'hold',
    nextDailyTarget: currentPlan.peakDayTarget,
    rationale: 'Steady progress — hold current target.',
  }
}

export { DAY_LABELS, MESOCYCLE_MULTIPLIER }
