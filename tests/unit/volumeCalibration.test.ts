import { describe, expect, it } from 'vitest'
import {
  deriveHistoryConfidence,
  deriveMaxCleanMismatchWarning,
  derivePlanCalibration,
  MAX_HINT_BASELINE,
  summarizeVolumeHistory,
  suggestWizardPrefill,
  volumeHistoryStatsFromRpc,
  type VolumeHistoryEntry,
  type VolumeHistoryStats,
} from '../../src/lib/training/volumeCalibration'
import { buildWeeklySchedule, getPeakDayTarget, type WizardAnswers } from '../../src/lib/training/planEngine'

const rhysLikeAnswers: WizardAnswers = {
  maxCleanSet: 20,
  trainingLevel: 'intermediate',
  preferredTrainingDays: [1, 2, 3, 5, 6],
  sorenessWarningAcknowledged: true,
  challengeIntensity: 'moderate',
  recentDailyAverage: 63,
}

function makeChallengeHistory(avgDaily: number, days: number, peakDaily?: number): VolumeHistoryEntry[] {
  const entries: VolumeHistoryEntry[] = []
  for (let index = 0; index < days; index += 1) {
    const day = `2026-05-${String(index + 1).padStart(2, '0')}`
    const dailyTotal =
      peakDaily !== undefined && index === days - 1 ? peakDaily : avgDaily
    const bankSize = Math.max(1, Math.round(dailyTotal / 3))
    for (let bank = 0; bank < 3; bank += 1) {
      entries.push({ count: bankSize, reps_in_reserve: null, logged_for: day })
    }
  }
  return entries
}

describe('summarizeVolumeHistory', () => {
  it('computes daily averages and peaks', () => {
    const stats = summarizeVolumeHistory([
      { count: 20, reps_in_reserve: 2, logged_for: '2026-06-01' },
      { count: 15, reps_in_reserve: null, logged_for: '2026-06-01' },
      { count: 30, reps_in_reserve: null, logged_for: '2026-06-02' },
    ])

    expect(stats.sampleDays).toBe(2)
    expect(stats.avgDailyTotal).toBe(32.5)
    expect(stats.peakDailyTotal).toBe(35)
    expect(stats.peakBank).toBe(30)
    expect(stats.estimatedMaxClean).toBe(22)
    expect(stats.lastLogDate).toBe('2026-06-02')
  })
})

describe('deriveHistoryConfidence', () => {
  it('returns trusted for recent dense history', () => {
    const stats: VolumeHistoryStats = {
      sampleDays: 10,
      avgDailyTotal: 50,
      peakDailyTotal: 70,
      peakBank: 25,
      estimatedMaxClean: 22,
      lastLogDate: '2026-06-28',
      daysSinceLastLog: 1,
    }

    expect(deriveHistoryConfidence(stats)).toBe('trusted')
  })

  it('returns stale when no sample days', () => {
    expect(
      deriveHistoryConfidence({
        sampleDays: 0,
        avgDailyTotal: 0,
        peakDailyTotal: 0,
        peakBank: 0,
        estimatedMaxClean: null,
        lastLogDate: null,
        daysSinceLastLog: null,
      }),
    ).toBe('stale')
  })

  it('returns stale when last log over 90 days ago', () => {
    expect(
      deriveHistoryConfidence({
        sampleDays: 20,
        avgDailyTotal: 50,
        peakDailyTotal: 70,
        peakBank: 25,
        estimatedMaxClean: 22,
        lastLogDate: '2025-01-01',
        daysSinceLastLog: 340,
      }),
    ).toBe('stale')
  })
})

describe('suggestWizardPrefill', () => {
  it('returns defaults without enough history', () => {
    const stats = summarizeVolumeHistory([
      { count: 10, reps_in_reserve: null, logged_for: '2026-06-01' },
    ])

    expect(suggestWizardPrefill(stats, 20)).toEqual({
      maxCleanSet: 20,
      recentDailyAverage: null,
      suggestedMaxCleanFromHistory: null,
    })
  })

  it('prefills daily average from 28-day history without overriding max clean', () => {
    const entries = makeChallengeHistory(58, 14)
    const stats = summarizeVolumeHistory(entries)

    const prefill = suggestWizardPrefill(stats)
    expect(prefill.recentDailyAverage).toBe(57)
    expect(prefill.maxCleanSet).toBe(15)
    expect(prefill.suggestedMaxCleanFromHistory).toBeGreaterThanOrEqual(19)
  })
})

describe('derivePlanCalibration', () => {
  it('rhys-like case uses trusted volume context and starts week 1', () => {
    const entries = makeChallengeHistory(63, 24, 95)
    const stats = summarizeVolumeHistory(entries)
    const calibration = derivePlanCalibration(rhysLikeAnswers, stats)

    expect(calibration.initialBaseline).toBe(1)
    expect(calibration.startMesocycleWeek).toBe(1)
    expect(calibration.volumeContext.trustMode).toBe('trusted')
    expect(calibration.volumeContext.volumeAnchor).toBeGreaterThan(0)
    expect(calibration.calibrationNote).toMatch(/recent average/i)
    expect(calibration.previewNote).toMatch(/63/i)

    const week1Schedule = buildWeeklySchedule(
      rhysLikeAnswers,
      calibration.startMesocycleWeek,
      calibration.initialBaseline,
      calibration.volumeContext,
    )
    expect(getPeakDayTarget(week1Schedule)).toBeGreaterThan(20)
  })

  it('calibrates from manual average without log history (partial trust)', () => {
    const calibration = derivePlanCalibration(rhysLikeAnswers, null)

    expect(calibration.initialBaseline).toBe(1)
    expect(calibration.startMesocycleWeek).toBe(1)
    expect(calibration.volumeContext.trustMode).toBe('partial')
    expect(calibration.previewNote).toMatch(/63|blend/i)
  })

  it('returns defaults without history or manual average', () => {
    const calibration = derivePlanCalibration(
      { ...rhysLikeAnswers, recentDailyAverage: null },
      null,
    )

    expect(calibration.initialBaseline).toBe(1)
    expect(calibration.startMesocycleWeek).toBe(1)
    expect(calibration.calibrationNote).toBeNull()
    expect(calibration.volumeContext.trustMode).toBe('none')
    expect(calibration.previewNote).toMatch(/conservatively|adjust as you log/i)
  })

  it('advanced intense max 20 avg 65 trusted W1 hits success bands', () => {
    const answers: WizardAnswers = {
      maxCleanSet: 20,
      trainingLevel: 'advanced',
      preferredTrainingDays: [1, 2, 3, 5, 6],
      sorenessWarningAcknowledged: true,
      challengeIntensity: 'intense',
      recentDailyAverage: 65,
    }

    const calibration = derivePlanCalibration(answers, null)

    expect(calibration.startMesocycleWeek).toBe(1)
    expect(calibration.maxCleanMismatchWarning).toMatch(/double-check max clean/i)

    const schedule = buildWeeklySchedule(
      answers,
      calibration.startMesocycleWeek,
      calibration.initialBaseline,
      { trustMode: 'trusted', volumeAnchor: 65 },
    )
    const challenge = Object.values(schedule).find((rx) => rx.dayType === 'challenge')
    expect(challenge?.target ?? 0).toBeGreaterThanOrEqual(45)
    expect(challenge?.target ?? 0).toBeLessThanOrEqual(55)
  })

  it('caps baseline hint at MAX_HINT_BASELINE for spike-heavy history', () => {
    const entries: VolumeHistoryEntry[] = []
    for (let index = 0; index < 14; index += 1) {
      entries.push({
        count: index === 13 ? 120 : 20,
        reps_in_reserve: null,
        logged_for: `2026-06-${String(index + 1).padStart(2, '0')}`,
      })
    }
    const stats = summarizeVolumeHistory(entries)
    const calibration = derivePlanCalibration(
      {
        ...rhysLikeAnswers,
        maxCleanSet: 20,
        recentDailyAverage: 100,
      },
      stats,
    )

    expect(calibration.initialBaseline).toBeLessThanOrEqual(MAX_HINT_BASELINE)
  })

  it('does not auto-skip to week 2 when peak daily exceeds double volume cap', () => {
    const entries: VolumeHistoryEntry[] = []
    for (let index = 0; index < 14; index += 1) {
      entries.push({
        count: index === 10 ? 80 : 25,
        reps_in_reserve: null,
        logged_for: `2026-06-${String(index + 1).padStart(2, '0')}`,
      })
    }
    const stats = summarizeVolumeHistory(entries)
    const calibration = derivePlanCalibration(
      { ...rhysLikeAnswers, recentDailyAverage: 40 },
      stats,
    )

    expect(calibration.startMesocycleWeek).toBe(1)
    expect(calibration.initialBaseline).toBeLessThanOrEqual(MAX_HINT_BASELINE)
  })
})

describe('deriveMaxCleanMismatchWarning', () => {
  it('warns when daily average far exceeds volume cap', () => {
    const warning = deriveMaxCleanMismatchWarning({
      maxCleanSet: 20,
      trainingLevel: 'advanced',
      preferredTrainingDays: [1, 2, 3, 5, 6],
      sorenessWarningAcknowledged: true,
      challengeIntensity: 'intense',
      recentDailyAverage: 65,
    })

    expect(warning).toMatch(/double-check max clean/i)
  })
})

describe('volumeHistoryStatsFromRpc', () => {
  it('returns zero-day stats for stale users', () => {
    const stats = volumeHistoryStatsFromRpc({
      sample_days: 0,
      avg_daily_total: 0,
      peak_daily_total: 0,
      peak_bank: 0,
      estimated_max_clean: null,
      last_log_date: '2025-01-01',
      days_since_last_log: 340,
    })

    expect(stats?.sampleDays).toBe(0)
    expect(stats?.daysSinceLastLog).toBe(340)
    expect(deriveHistoryConfidence(stats)).toBe('stale')
  })
})
