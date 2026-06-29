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
  recent_daily_average?: number | null
  calibration_note?: string | null
  wizard_soreness_level?: string | null
}

type VolumeTrustMode = 'none' | 'partial' | 'trusted'

type VolumeCalibrationContext = {
  trustMode: VolumeTrustMode
  volumeAnchor: number | null
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

const TRUSTED_INTENSITY_FACTOR: Record<string, number> = {
  light: 0.95,
  moderate: 1.0,
  intense: 1.05,
}

const BANDS_TRUSTED: Record<number, Record<DayType, readonly [number, number]>> = {
  1: {
    rest: [0, 0],
    easy: [0.32, 0.43],
    moderate: [0.54, 0.62],
    challenge: [0.69, 0.85],
  },
  2: {
    rest: [0, 0],
    easy: [0.4, 0.5],
    moderate: [0.6, 0.7],
    challenge: [0.65, 0.8],
  },
  3: {
    rest: [0, 0],
    easy: [0.5, 0.6],
    moderate: [0.7, 0.85],
    challenge: [0.75, 1.0],
  },
  4: {
    rest: [0, 0],
    easy: [0.24, 0.36],
    moderate: [0.4, 0.48],
    challenge: [0.4, 0.6],
  },
}

const CEILING_BY_WEEK: Record<number, number> = {
  1: 1.1,
  2: 1.05,
  3: 1.1,
  4: 0.65,
}

const SET_COUNT_LIMITS: Record<DayType, { min: number; max: number }> = {
  rest: { min: 0, max: 0 },
  easy: { min: 2, max: 5 },
  moderate: { min: 3, max: 6 },
  challenge: { min: 3, max: 7 },
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

function parseCalibrationNote(note?: string | null): {
  trustMode: VolumeTrustMode | null
  manualConfirmed: boolean
} {
  if (!note?.trim()) {
    return { trustMode: null, manualConfirmed: false }
  }

  const match = note.match(/^@vt:(none|partial|trusted)(?:;mc:(0|1))?@/)
  if (!match) {
    return { trustMode: null, manualConfirmed: false }
  }

  return {
    trustMode: match[1] as VolumeTrustMode,
    manualConfirmed: match[2] === '1',
  }
}

function volumeContextFromRow(row: TrainingPlanRow): VolumeCalibrationContext {
  const parsed = parseCalibrationNote(row.calibration_note)
  const avg = row.recent_daily_average
  let trustMode: VolumeTrustMode = parsed.trustMode ?? 'none'

  if (trustMode === 'none' && avg != null && avg > 0) {
    trustMode = 'partial'
  }

  if (avg == null || avg <= 0) {
    return { trustMode: 'none', volumeAnchor: null }
  }

  let anchor = Math.max(0, Math.round(avg))
  if (trustMode === 'partial') {
    const referencePeak = computeConservativeDayTarget(row, 'challenge', 3)
    anchor = Math.min(anchor, Math.max(0, Math.round(referencePeak * 1.25)))
  }

  return { trustMode, volumeAnchor: anchor }
}

function computeEffectiveSetSize(
  maxClean: number,
  dayType: DayType,
  bandMax: number,
  minSets: number,
): number {
  if (dayType === 'rest') return 0
  const upperBound = computeSetSizeForDay(maxClean, dayType)
  const floor = minSetSize(maxClean)
  if (bandMax <= 0 || minSets <= 0) return upperBound
  const volumeLimited = Math.floor(bandMax / minSets)
  return clamp(volumeLimited, floor, upperBound)
}

function computeTargetBand(
  dayType: DayType,
  mesocycleWeek: number,
  volumeAnchor: number,
  row: TrainingPlanRow,
): { min: number; max: number; midpoint: number } {
  const [loPct, hiPct] = BANDS_TRUSTED[mesocycleWeek][dayType]
  let lo = volumeAnchor * loPct
  let hi = volumeAnchor * hiPct
  hi *= TRUSTED_INTENSITY_FACTOR[row.challenge_intensity] ?? 1
  lo *= LEVEL_VOLUME_FACTOR[row.training_level] ?? 1

  const soreness = row.wizard_soreness_level
  if (soreness === 'notable' || soreness === 'mild') {
    lo *= 0.85
    hi *= 0.85
  }

  const min = Math.max(0, Math.round(lo))
  const max = Math.max(0, Math.round(hi))
  return { min, max, midpoint: Math.max(0, Math.round((min + max) / 2)) }
}

function convertTargetToSetsAndSetSize(
  targetMid: number,
  targetMin: number,
  setSize: number,
  minSets: number,
  maxSets: number,
): { target: number; sets: number; setSize: number } {
  if (setSize <= 0 || maxSets <= 0) return { target: 0, sets: 0, setSize: 0 }
  let sets = clamp(Math.round(targetMid / setSize), minSets, maxSets)
  let adjustedTarget = sets * setSize
  while (adjustedTarget < targetMin && sets < maxSets) {
    sets += 1
    adjustedTarget = sets * setSize
  }
  return { target: adjustedTarget, sets, setSize }
}

function computeConservativeDayTarget(
  row: TrainingPlanRow,
  dayType: DayType,
  mesocycleWeek: number,
): number {
  if (dayType === 'rest') return 0
  const sets = setsForDayType(dayType, row.training_level)
  const setSize = computeSetSizeForDay(row.max_clean_set, dayType)
  let target = sets * setSize
  target = Math.max(
    0,
    Math.round(
      target *
        (LEVEL_VOLUME_FACTOR[row.training_level] ?? 1) *
        (INTENSITY_VOLUME_FACTOR[row.challenge_intensity] ?? 1) *
        (MESOCYCLE_MULTIPLIER[mesocycleWeek] ?? 1) *
        (row.plan_baseline ?? 1),
    ),
  )
  const cap = dailyVolumeCap(row.max_clean_set)
  return applyVolumeCapCoherent(target, sets, setSize, cap, row.max_clean_set).target
}

function applyTrustedSafetyCaps(
  trustMode: VolumeTrustMode,
  dayType: DayType,
  mesocycleWeek: number,
  target: number,
  sets: number,
  setSize: number,
  maxClean: number,
  volumeAnchor: number | null,
  sorenessLevel?: string | null,
): { target: number; sets: number; setSize: number } {
  const maxSetSize = computeSetSizeForDay(maxClean, dayType)
  const effectiveSetSize = Math.min(setSize, maxSetSize)

  if (trustMode === 'none' || !volumeAnchor || volumeAnchor <= 0) {
    return applyVolumeCapCoherent(
      target,
      sets,
      effectiveSetSize,
      dailyVolumeCap(maxClean),
      maxClean,
    )
  }

  let dailyCeiling =
    trustMode === 'partial'
      ? dailyVolumeCap(maxClean)
      : volumeAnchor * (CEILING_BY_WEEK[mesocycleWeek] ?? 1.1)

  if (sorenessLevel === 'mild' || sorenessLevel === 'notable') {
    dailyCeiling *= 0.75
  }

  if (trustMode === 'trusted' && mesocycleWeek <= 2) {
    dailyCeiling = Math.min(dailyCeiling, volumeAnchor * 1.25)
  }

  return applyVolumeCapCoherent(
    target,
    sets,
    effectiveSetSize,
    Math.max(0, Math.round(dailyCeiling)),
    maxClean,
  )
}

function buildTrustedDayPrescription(
  row: TrainingPlanRow,
  dayType: DayType,
  mesocycleWeek: number,
  ctx: VolumeCalibrationContext,
): { target: number; sets: number; setSize: number } {
  if (dayType === 'rest') return { target: 0, sets: 0, setSize: 0 }

  const conservativeTarget = computeConservativeDayTarget(row, dayType, mesocycleWeek)
  const anchor = ctx.volumeAnchor
  const limits = SET_COUNT_LIMITS[dayType]

  if (ctx.trustMode === 'none' || !anchor || anchor <= 0) {
    const setSize = computeSetSizeForDay(row.max_clean_set, dayType)
    const sets = setsForDayType(dayType, row.training_level)
    return applyTrustedSafetyCaps(
      'none',
      dayType,
      mesocycleWeek,
      conservativeTarget,
      sets,
      setSize,
      row.max_clean_set,
      null,
      row.wizard_soreness_level,
    )
  }

  const band = computeTargetBand(dayType, mesocycleWeek, anchor, row)
  let targetMid = band.midpoint

  if (ctx.trustMode === 'partial') {
    targetMid = Math.max(
      0,
      Math.round(conservativeTarget + 0.5 * (band.midpoint - conservativeTarget)),
    )
    targetMid = clamp(targetMid, band.min, band.max)
  }

  const setSize = computeEffectiveSetSize(
    row.max_clean_set,
    dayType,
    band.max,
    limits.min,
  )

  const converted = convertTargetToSetsAndSetSize(
    targetMid,
    band.min,
    setSize,
    limits.min,
    limits.max,
  )

  return applyTrustedSafetyCaps(
    ctx.trustMode,
    dayType,
    mesocycleWeek,
    converted.target,
    converted.sets,
    converted.setSize,
    row.max_clean_set,
    anchor,
    row.wizard_soreness_level,
  )
}

function buildWeeklySchedule(
  row: TrainingPlanRow,
  mesocycleWeek: number,
): WeeklySchedule {
  const ctx = volumeContextFromRow(row)

  let trainingDays = [...(row.preferred_training_days ?? [])].sort((a, b) => a - b)
  if (trainingDays.length === 0) trainingDays = [...DEFAULT_PREFERRED_TRAINING_DAYS]

  const assignment = assignDayTypes(trainingDays, row.training_level)
  enforceChallengeSpacing(assignment)
  const schedule: WeeklySchedule = {}

  for (const day of ALL_DAYS) {
    const dayType = assignment.get(day) ?? 'rest'
    const prescription = buildTrustedDayPrescription(row, dayType, mesocycleWeek, ctx)

    schedule[day] = {
      dayType,
      target: prescription.target,
      setSize: prescription.setSize,
      sets: prescription.sets,
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
