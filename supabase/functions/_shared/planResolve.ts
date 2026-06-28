/**
 * Deno-compatible training plan resolver for edge functions.
 * Logic mirrors src/lib/training/planEngine.ts — keep in sync when formulas change.
 */

type DayType = 'rest' | 'easy' | 'moderate' | 'challenge'

type DayPrescription = {
  dayType: DayType
  target: number
  setSize: number
  sets: number
}

type WeeklySchedule = Record<number, DayPrescription>

type TrainingPlanRow = {
  max_clean_set: number
  training_level: string
  challenge_intensity: string
  preferred_training_days: number[]
  mesocycle_started_at: string
  plan_baseline: number
  wizard_completed: boolean
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

const MESOCYCLE_MULTIPLIER: Record<number, number> = {
  1: 0.7,
  2: 0.85,
  3: 1.0,
  4: 0.55,
}

const LEVEL_VOLUME_FACTOR: Record<string, number> = {
  beginner: 0.85,
  intermediate: 0.95,
  advanced: 1.0,
}

const INTENSITY_VOLUME_FACTOR: Record<string, number> = {
  light: 0.85,
  moderate: 1.0,
  intense: 1.1,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function computeSetSize(maxCleanSet: number): number {
  return clamp(Math.round(maxCleanSet * 0.45), 5, Math.min(maxCleanSet, 15))
}

function dailyVolumeCap(maxCleanSet: number): number {
  return Math.min(maxCleanSet * 2, maxCleanSet + 15)
}

function setsForDayType(dayType: DayType, trainingLevel: string): number {
  if (dayType === 'rest') return 0
  if (dayType === 'easy') return 2
  if (dayType === 'moderate') return 3
  return trainingLevel === 'beginner' ? 3 : 4
}

function assignDayTypes(trainingDays: number[], trainingLevel: string): Map<number, DayType> {
  const sorted = [...trainingDays].sort((a, b) => a - b)
  const assignment = new Map<number, DayType>()
  if (sorted.length === 0) return assignment

  const patterns: Record<number, DayType[]> = {
    1: ['moderate'],
    2: ['easy', 'challenge'],
    3: ['easy', 'moderate', 'challenge'],
    4: ['easy', 'moderate', 'moderate', 'challenge'],
    5: ['easy', 'moderate', 'moderate', 'challenge', 'easy'],
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

function buildWeeklySchedule(
  row: TrainingPlanRow,
  mesocycleWeek: number,
): WeeklySchedule {
  const setSize = computeSetSize(row.max_clean_set)
  const volumeCap = dailyVolumeCap(row.max_clean_set)
  const levelFactor = LEVEL_VOLUME_FACTOR[row.training_level] ?? 1
  const intensityFactor = INTENSITY_VOLUME_FACTOR[row.challenge_intensity] ?? 1
  const mesoFactor = MESOCYCLE_MULTIPLIER[mesocycleWeek] ?? 1
  const planBaseline = row.plan_baseline ?? 1

  let trainingDays = [...(row.preferred_training_days ?? [])].sort((a, b) => a - b)
  if (trainingDays.length === 0) trainingDays = [1, 2, 3, 4]

  const assignment = assignDayTypes(trainingDays, row.training_level)
  const schedule: WeeklySchedule = {}

  for (const day of ALL_DAYS) {
    const dayType = assignment.get(day) ?? 'rest'
    const sets = setsForDayType(dayType, row.training_level)
    let target = sets * setSize
    target = Math.max(0, Math.round(target * levelFactor * intensityFactor * mesoFactor * planBaseline))
    target = Math.min(target, volumeCap)

    schedule[day] = { dayType, target, setSize, sets }
  }

  return schedule
}

export function dayOfWeekFromIso(date: string, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  })
  const weekday = formatter.format(new Date(`${date}T12:00:00Z`))
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  return index >= 0 ? index : new Date(`${date}T12:00:00Z`).getUTCDay()
}

export function getCurrentMesocycleWeek(mesocycleStartedAt: string, today: string): number {
  const start = new Date(`${mesocycleStartedAt}T12:00:00Z`)
  const current = new Date(`${today}T12:00:00Z`)
  const days = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000))
  const weekIndex = Math.floor(days / 7) % 4
  return weekIndex + 1
}

export function resolveTodayTarget(
  row: TrainingPlanRow | null,
  localDate: string,
  timezone: string,
  fallbackTarget: number,
): number {
  if (!row?.wizard_completed) {
    return fallbackTarget
  }

  const mesocycleWeek = getCurrentMesocycleWeek(row.mesocycle_started_at, localDate)
  const schedule = buildWeeklySchedule(row, mesocycleWeek)
  const dayOfWeek = dayOfWeekFromIso(localDate, timezone)
  return schedule[dayOfWeek]?.target ?? fallbackTarget
}

export function isRestDayTarget(
  row: TrainingPlanRow | null,
  localDate: string,
  timezone: string,
): boolean {
  if (!row?.wizard_completed) return false
  return resolveTodayTarget(row, localDate, timezone, 0) === 0
}
