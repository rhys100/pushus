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
  mesocycle_block_start_week?: number | null
  plan_baseline: number
  wizard_completed: boolean
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const DEFAULT_PREFERRED_TRAINING_DAYS = [1, 2, 3, 5, 6]

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

const EFFORT_RATIO: Record<DayType, number> = {
  rest: 0,
  easy: 0.35,
  moderate: 0.5,
  challenge: 0.6,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function minSetSize(maxCleanSet: number): number {
  if (maxCleanSet <= 3) return 1
  return 2
}

function computeSetSizeForDay(maxCleanSet: number, dayType: DayType): number {
  if (dayType === 'rest') return 0
  const raw = Math.round(maxCleanSet * EFFORT_RATIO[dayType])
  const floor = minSetSize(maxCleanSet)
  const ceiling = Math.min(15, Math.max(1, maxCleanSet - 1))
  return clamp(raw, floor, ceiling)
}

function dailyVolumeCap(maxCleanSet: number): number {
  return Math.min(maxCleanSet * 2, maxCleanSet + 15)
}

function applyVolumeCapCoherent(
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
    4: ['easy', 'easy', 'moderate', 'challenge'],
    5: ['easy', 'easy', 'moderate', 'easy', 'challenge'],
    6: ['easy', 'easy', 'moderate', 'easy', 'challenge', 'moderate'],
    7: ['easy', 'easy', 'moderate', 'easy', 'challenge', 'moderate', 'easy'],
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

function getMesocycleWeekInBlock(
  mesocycleStartedAt: string,
  today: string,
  blockStartWeek: number,
): number {
  const start = new Date(`${mesocycleStartedAt}T12:00:00Z`)
  const current = new Date(`${today}T12:00:00Z`)
  const days = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000))
  const weeksElapsed = Math.floor(days / 7)
  return (((blockStartWeek - 1 + weeksElapsed) % 4) + 1)
}

function buildWeeklySchedule(
  row: TrainingPlanRow,
  mesocycleWeek: number,
): WeeklySchedule {
  const volumeCap = dailyVolumeCap(row.max_clean_set)
  const levelFactor = LEVEL_VOLUME_FACTOR[row.training_level] ?? 1
  const intensityFactor = INTENSITY_VOLUME_FACTOR[row.challenge_intensity] ?? 1
  const mesoFactor = MESOCYCLE_MULTIPLIER[mesocycleWeek] ?? 1
  const planBaseline = row.plan_baseline ?? 1

  let trainingDays = [...(row.preferred_training_days ?? [])].sort((a, b) => a - b)
  if (trainingDays.length === 0) trainingDays = [...DEFAULT_PREFERRED_TRAINING_DAYS]

  const assignment = assignDayTypes(trainingDays, row.training_level)
  enforceChallengeSpacing(assignment)
  const schedule: WeeklySchedule = {}

  for (const day of ALL_DAYS) {
    const dayType = assignment.get(day) ?? 'rest'
    const sets = setsForDayType(dayType, row.training_level)
    const setSize = computeSetSizeForDay(row.max_clean_set, dayType)
    let target = sets * setSize
    target = Math.max(
      0,
      Math.round(target * levelFactor * intensityFactor * mesoFactor * planBaseline),
    )
    const capped = applyVolumeCapCoherent(target, sets, setSize, volumeCap, row.max_clean_set)

    schedule[day] = {
      dayType,
      target: capped.target,
      setSize: capped.setSize,
      sets: capped.sets,
    }
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

export function resolveTodayPrescription(
  row: TrainingPlanRow | null,
  localDate: string,
  timezone: string,
): DayPrescription | null {
  if (!row?.wizard_completed) {
    return null
  }

  const blockStartWeek = Math.min(4, Math.max(1, row.mesocycle_block_start_week ?? 1))
  const mesocycleWeek = getMesocycleWeekInBlock(
    row.mesocycle_started_at,
    localDate,
    blockStartWeek,
  )
  const schedule = buildWeeklySchedule(row, mesocycleWeek)
  const dayOfWeek = dayOfWeekFromIso(localDate, timezone)
  const prescription = schedule[dayOfWeek]

  if (!prescription || prescription.target === 0 || prescription.dayType === 'rest') {
    return null
  }

  return prescription
}

export function resolveTodayTarget(
  row: TrainingPlanRow | null,
  localDate: string,
  timezone: string,
): number | null {
  if (!row?.wizard_completed) {
    return null
  }

  const blockStartWeek = Math.min(4, Math.max(1, row.mesocycle_block_start_week ?? 1))
  const mesocycleWeek = getMesocycleWeekInBlock(
    row.mesocycle_started_at,
    localDate,
    blockStartWeek,
  )
  const schedule = buildWeeklySchedule(row, mesocycleWeek)
  const dayOfWeek = dayOfWeekFromIso(localDate, timezone)
  return schedule[dayOfWeek]?.target ?? null
}

export function isRestDayTarget(
  row: TrainingPlanRow | null,
  localDate: string,
  timezone: string,
): boolean {
  if (!row?.wizard_completed) return false
  const target = resolveTodayTarget(row, localDate, timezone)
  return target === null || target === 0
}
