import { describe, expect, it } from 'vitest'
import {
  derivePlanCalibration,
  MAX_INITIAL_BASELINE,
  summarizeVolumeHistory,
  suggestWizardPrefill,
  type VolumeHistoryEntry,
} from '../../src/lib/training/volumeCalibration'
import { buildWeeklySchedule, getPeakDayTarget, type WizardAnswers } from '../../src/lib/training/planEngine'

const rhysLikeAnswers: WizardAnswers = {
  maxCleanSet: 20,
  trainingLevel: 'intermediate',
  preferredTrainingDays: [0, 1, 2, 3, 4, 5],
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
    })
  })

  it('prefills from 28-day history', () => {
    const entries = makeChallengeHistory(58, 14)
    const stats = summarizeVolumeHistory(entries)

    const prefill = suggestWizardPrefill(stats)
    expect(prefill.recentDailyAverage).toBe(57)
    expect(prefill.maxCleanSet).toBeGreaterThanOrEqual(19)
  })
})

describe('derivePlanCalibration', () => {
  it('rhys-like case increases baseline and can start at week 2', () => {
    const entries = makeChallengeHistory(63, 24, 95)
    const stats = summarizeVolumeHistory(entries)
    const calibration = derivePlanCalibration(rhysLikeAnswers, stats)

    expect(calibration.initialBaseline).toBeGreaterThan(1)
    expect(calibration.initialBaseline).toBeLessThanOrEqual(MAX_INITIAL_BASELINE)
    expect(calibration.startMesocycleWeek).toBe(2)
    expect(calibration.calibrationNote).toMatch(/recent avg 63/i)
    expect(calibration.previewNote).toMatch(/recent avg 63/i)

    const week1Schedule = buildWeeklySchedule(
      rhysLikeAnswers,
      calibration.startMesocycleWeek,
      calibration.initialBaseline,
    )
    expect(getPeakDayTarget(week1Schedule)).toBeGreaterThan(26)
  })

  it('returns defaults without history', () => {
    const calibration = derivePlanCalibration(rhysLikeAnswers, null)

    expect(calibration.initialBaseline).toBe(1)
    expect(calibration.startMesocycleWeek).toBe(1)
    expect(calibration.calibrationNote).toBeNull()
  })

  it('caps baseline at 1.35 for spike-heavy history', () => {
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

    expect(calibration.initialBaseline).toBeLessThanOrEqual(MAX_INITIAL_BASELINE)
  })

  it('starts week 2 when peak daily exceeds double volume cap', () => {
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

    expect(calibration.startMesocycleWeek).toBe(2)
    expect(calibration.calibrationNote).toMatch(/85%/)
  })
})
