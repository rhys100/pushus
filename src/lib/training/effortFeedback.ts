export type EffortEntry = {
  count: number
  reps_in_reserve: number | null
  logged_for: string
}

export type EffortSummary = {
  sampleCount: number
  observedMax: number | null
  medianRir: number | null
  zeroRirRate: number
  highRirRate: number
  hardRate: number
}

export type EffortProgressionDecision = 'increase' | 'hold' | 'reduce'

export type DailyGoalLog = {
  date: string
  banked: number
  target: number
  isRestDay: boolean
}

const MIN_RIR_SAMPLES = 3

export function observedSetMax(entry: EffortEntry): number | null {
  if (entry.reps_in_reserve === null) {
    return null
  }

  return entry.count + entry.reps_in_reserve
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }

  return sorted[mid]
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function filterEffortEntriesSince(
  entries: EffortEntry[],
  sinceDate: string,
): EffortEntry[] {
  return entries.filter((entry) => entry.logged_for >= sinceDate)
}

export function summarizeEffort(entries: EffortEntry[]): EffortSummary {
  const withRir = entries.filter((entry) => entry.reps_in_reserve !== null)

  if (withRir.length === 0) {
    return {
      sampleCount: 0,
      observedMax: null,
      medianRir: null,
      zeroRirRate: 0,
      highRirRate: 0,
      hardRate: 0,
    }
  }

  const rirValues = withRir.map((entry) => entry.reps_in_reserve as number)
  const observedValues = withRir
    .map(observedSetMax)
    .filter((value): value is number => value !== null)

  const zeroCount = rirValues.filter((rir) => rir === 0).length
  const highCount = rirValues.filter((rir) => rir >= 3).length
  const hardCount = rirValues.filter((rir) => rir <= 1).length

  return {
    sampleCount: withRir.length,
    observedMax: observedValues.length > 0 ? Math.max(...observedValues) : null,
    medianRir: median(rirValues),
    zeroRirRate: zeroCount / withRir.length,
    highRirRate: highCount / withRir.length,
    hardRate: hardCount / withRir.length,
  }
}

export function deriveProgressionFromEffort(
  summary: EffortSummary,
  _wizardMaxCleanSet: number,
  hitRate: number,
): EffortProgressionDecision {
  if (summary.sampleCount < MIN_RIR_SAMPLES) {
    if (hitRate >= 0.8) {
      return 'increase'
    }

    if (hitRate < 0.5) {
      return 'hold'
    }

    return 'hold'
  }

  if (
    hitRate >= 0.8 &&
    summary.highRirRate >= 0.5
  ) {
    return 'increase'
  }

  if (summary.hardRate >= 0.5 && hitRate < 0.6) {
    return 'reduce'
  }

  if (summary.hardRate >= 0.4 || hitRate < 0.5) {
    return 'hold'
  }

  if (hitRate >= 0.8) {
    return 'increase'
  }

  return 'hold'
}

export function computeHitRate(dailyLogs: DailyGoalLog[]): number {
  const trainingDays = dailyLogs.filter((log) => !log.isRestDay && log.target > 0)

  if (trainingDays.length === 0) {
    return 0
  }

  const goalMetDays = trainingDays.filter((log) => log.banked >= log.target).length
  return goalMetDays / trainingDays.length
}

export function buildRecentDailyLogs(
  todayIso: string,
  dayCount: number,
  getDayLog: (date: string) => DailyGoalLog,
): DailyGoalLog[] {
  const logs: DailyGoalLog[] = []

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const date = addDays(todayIso, -offset)
    logs.push(getDayLog(date))
  }

  return logs
}

export function effortSummarySince(
  entries: EffortEntry[],
  sinceDate: string,
): EffortSummary {
  return summarizeEffort(filterEffortEntriesSince(entries, sinceDate))
}

export { MIN_RIR_SAMPLES }
