import { describe, expect, it } from 'vitest'
import {
  advanceMesocycleIfDue,
  buildWeeklySchedule,
  computeSetSize,
  computeSetSizeForDay,
  dailyVolumeCap,
  formatDayTarget,
  formatDayTargetSetsDetail,
  formatWeeklyScheduleSummary,
  getCurrentMesocycleWeek,
  getDefaultPlan,
  getPeakDayTarget,
  getTodayPrescription,
  MESOCYCLE_MULTIPLIER,
  planFromRow,
  recommendFromWizard,
  type WizardAnswers,
  wizardAnswersFromPlanRow,
} from '../../src/lib/training/planEngine'

const advancedMax20: WizardAnswers = {
  maxCleanSet: 20,
  trainingLevel: 'advanced',
  preferredTrainingDays: [1, 2, 3, 5, 6],
  sorenessWarningAcknowledged: true,
  challengeIntensity: 'moderate',
}

describe('planEngine v2', () => {
  it('returns default plan with weekly schedule', () => {
    const plan = getDefaultPlan()

    expect(plan.weeklySchedule).toBeDefined()
    expect(plan.peakDayTarget).toBeGreaterThan(0)
    expect(plan.setSize).toBeGreaterThan(0)
    expect(plan.restDays.length).toBeGreaterThanOrEqual(1)
    expect(plan.disclaimer).toMatch(/not medical advice/i)
  })

  it('computes day-type set sizes for max 20', () => {
    expect(computeSetSize(20)).toBe(10)
    expect(computeSetSizeForDay(20, 'easy')).toBe(7)
    expect(computeSetSizeForDay(20, 'moderate')).toBe(10)
    expect(computeSetSizeForDay(20, 'challenge')).toBe(12)
    expect(dailyVolumeCap(20)).toBe(35)
  })

  it('computeSetSizeForDay matrix matches v2 reference', () => {
    const cases: [number, number, number, number][] = [
      [1, 1, 1, 1],
      [5, 2, 3, 3],
      [20, 7, 10, 12],
      [40, 14, 15, 15],
    ]

    for (const [max, easy, moderate, challenge] of cases) {
      expect(computeSetSizeForDay(max, 'easy')).toBe(easy)
      expect(computeSetSizeForDay(max, 'moderate')).toBe(moderate)
      expect(computeSetSizeForDay(max, 'challenge')).toBe(challenge)
    }
  })

  it('advanced max 20 never recommends 50/day peak', () => {
    const { plan } = recommendFromWizard(advancedMax20)

    expect(plan.peakDayTarget).toBeLessThanOrEqual(36)
    expect(plan.peakDayTarget).not.toBe(50)
    expect(plan.setSize).toBe(10)
    expect(plan.restDays.length).toBeGreaterThanOrEqual(1)
  })

  it('assigns tiered targets across the default week pattern', () => {
    const schedule = buildWeeklySchedule(advancedMax20, 3)

    expect(schedule[0].dayType).toBe('rest')
    expect(schedule[4].dayType).toBe('rest')
    expect(schedule[6].dayType).toBe('challenge')
    expect(schedule[1].target).toBeGreaterThan(0)
    expect(schedule[6].target).toBeGreaterThan(schedule[1].target)
  })

  it('rest day has zero target', () => {
    const schedule = buildWeeklySchedule(advancedMax20, 3)
    const restDay = schedule[0]

    expect(restDay.dayType).toBe('rest')
    expect(restDay.target).toBe(0)
  })

  it('beginner with 3 training days has lower volume and enough rest', () => {
    const { plan } = recommendFromWizard({
      maxCleanSet: 10,
      trainingLevel: 'beginner',
      preferredTrainingDays: [1, 3, 5],
      sorenessWarningAcknowledged: true,
      challengeIntensity: 'light',
    })

    expect(plan.restDays.length).toBeGreaterThanOrEqual(2)
    expect(plan.peakDayTarget).toBeLessThan(
      recommendFromWizard(advancedMax20).plan.peakDayTarget,
    )
  })

  it('mesocycle W1 targets are lower than W3 on easy day', () => {
    const w1 = buildWeeklySchedule(advancedMax20, 1)
    const w3 = buildWeeklySchedule(advancedMax20, 3)

    expect(w3[1].target).toBeGreaterThan(w1[1].target)
  })

  it('mesocycle W4 deload is roughly 55% of W3 on easy day', () => {
    const w3 = buildWeeklySchedule(advancedMax20, 3)
    const w4 = buildWeeklySchedule(advancedMax20, 4)

    expect(w4[1].target).toBeLessThan(w3[1].target)
    expect(w4[1].target / w3[1].target).toBeCloseTo(
      MESOCYCLE_MULTIPLIER[4] / MESOCYCLE_MULTIPLIER[3],
      1,
    )
  })

  it('getTodayPrescription returns rest day on Sunday', () => {
    const { plan } = recommendFromWizard(advancedMax20)
    const monday = getTodayPrescription(plan, '2026-06-29', 'UTC')

    expect(monday.isRestDay).toBe(false)
    expect(monday.target).toBeGreaterThan(0)

    const sunday = getTodayPrescription(plan, '2026-06-28', 'UTC')
    expect(sunday.isRestDay).toBe(true)
    expect(sunday.target).toBe(0)
  })

  it('getTodayPrescription reports the plan stored mesocycle week', () => {
    const { plan } = recommendFromWizard(advancedMax20)
    const week3Plan = { ...plan, mesocycleWeek: 3 as const }

    const prescription = getTodayPrescription(week3Plan, '2026-06-01', 'UTC')

    expect(prescription.mesocycleWeek).toBe(3)
    expect(prescription.mesocycleWeek).not.toBe(getCurrentMesocycleWeek(week3Plan.mesocycleStartedAt, '2026-06-01'))
  })

  it('getCurrentMesocycleWeek advances over time', () => {
    expect(getCurrentMesocycleWeek('2026-06-01', '2026-06-01')).toBe(1)
    expect(getCurrentMesocycleWeek('2026-06-01', '2026-06-08')).toBe(2)
    expect(getCurrentMesocycleWeek('2026-06-01', '2026-06-22')).toBe(4)
    expect(getCurrentMesocycleWeek('2026-06-01', '2026-06-29')).toBe(1)
  })

  it('advanceMesocycleIfDue increases baseline after strong mesocycle without auto max-clean bump', () => {
    const { plan } = recommendFromWizard(advancedMax20)
    const startPlan = { ...plan, mesocycleStartedAt: '2026-01-01' }

    const result = advanceMesocycleIfDue(startPlan, advancedMax20, '2026-01-29', 0.9)

    expect(result.advanced).toBe(true)
    expect(result.plan.planBaseline).toBeGreaterThan(1)
    expect(result.maxCleanSet).toBe(20)
    expect(result.progressionNote).toMatch(/5%|effort feedback|volume/i)
  })

  it('advanceMesocycleIfDue uses effort feedback when RIR samples are rich', () => {
    const { plan } = recommendFromWizard(advancedMax20)
    const startPlan = { ...plan, mesocycleStartedAt: '2026-01-01', planBaseline: 1 }
    const effortSummary = {
      sampleCount: 4,
      observedMax: 22,
      medianRir: 2,
      zeroRirRate: 0.25,
      highRirRate: 0.5,
      hardRate: 0.25,
    }

    const result = advanceMesocycleIfDue(
      startPlan,
      advancedMax20,
      '2026-01-29',
      0.85,
      effortSummary,
    )

    expect(result.advanced).toBe(true)
    expect(result.maxCleanSet).toBe(20)
    expect(result.progressionNote).toMatch(/effort feedback|volume|manageable/i)
  })

  it('advanceMesocycleIfDue holds baseline on low hit rate', () => {
    const { plan } = recommendFromWizard(advancedMax20)
    const startPlan = { ...plan, mesocycleStartedAt: '2026-01-01', planBaseline: 1 }

    const result = advanceMesocycleIfDue(startPlan, advancedMax20, '2026-01-29', 0.3)

    expect(result.plan.planBaseline).toBe(1)
    expect(result.progressionNote).toMatch(/holding|tough/i)
  })

  it('planFromRow rebuilds from wizard fields when schedule empty', () => {
    const plan = planFromRow({
      max_clean_set: 20,
      training_level: 'advanced',
      challenge_intensity: 'moderate',
      preferred_training_days: [1, 2, 3, 5, 6],
      weekly_schedule: null,
      mesocycle_week: 1,
      mesocycle_started_at: '2026-06-01',
      plan_baseline: 1,
    })

    expect(getPeakDayTarget(plan.weeklySchedule)).toBeGreaterThan(0)
    expect(plan.peakDayTarget).toBeLessThanOrEqual(36)
  })

  it('wizardAnswersFromPlanRow maps stored values', () => {
    const answers = wizardAnswersFromPlanRow({
      max_clean_set: 25,
      training_level: 'intermediate',
      challenge_intensity: 'intense',
      preferred_training_days: [1, 3, 5],
    })

    expect(answers.maxCleanSet).toBe(25)
    expect(answers.trainingLevel).toBe('intermediate')
    expect(answers.challengeIntensity).toBe('intense')
  })

  it('recommendFromWizard summary mentions 4-week build', () => {
    const { summary } = recommendFromWizard(advancedMax20)
    expect(summary).toMatch(/4-week/)
    expect(summary).toMatch(/Peak day/)
  })

  it('formatDayTarget shows scaled volume honestly', () => {
    const w1 = buildWeeklySchedule(advancedMax20, 1)
    expect(formatDayTarget(w1[1])).toMatch(/total · ~\d+\/set/)

    const w3 = buildWeeklySchedule(advancedMax20, 3)
    expect(formatDayTarget(w3[6])).toMatch(/\d+ \(2×\d+\)|\d+ \(4×\d+\)|\d+ total/)
  })

  it('formatDayTargetSetsDetail explains partial sets', () => {
    const w1 = buildWeeklySchedule(advancedMax20, 1)
    const detail = formatDayTargetSetsDetail(w1[1])

    expect(detail).toMatch(/sets · ~\d+ each/)
  })

  it('formatWeeklyScheduleSummary uses formatDayTarget', () => {
    const schedule = buildWeeklySchedule(advancedMax20, 1)
    const summary = formatWeeklyScheduleSummary(schedule)

    expect(summary).toMatch(/total · ~/)
  })
})
