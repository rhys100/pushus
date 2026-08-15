import { describe, expect, it } from 'vitest'
import { buildTargetExplanation } from '@/lib/training/targetExplanation'
import type { TodayPrescription, TrainingPlan } from '@/lib/training/planEngine'

function plan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    planMaxClean: 30,
    setSize: 10,
    trainingDaysPerWeek: 4,
    mesocycleWeek: 2,
    peakDayTarget: 60,
    ...overrides,
  } as unknown as TrainingPlan
}

function prescription(overrides: Partial<TodayPrescription> = {}): TodayPrescription {
  return {
    dayType: 'moderate',
    dayTypeLabel: 'Moderate',
    target: 45,
    setSize: 15,
    sets: 3,
    label: '',
    isRestDay: false,
    mesocycleWeek: 2,
    suggestMaxCheckIn: false,
    safetyNote: null,
    ...overrides,
  } as unknown as TodayPrescription
}

const base = {
  plan: plan(),
  prescription: prescription(),
  dailyTarget: 45,
  isRampBack: false,
  wizardSorenessLevel: null,
}

function allText(input: Parameters<typeof buildTargetExplanation>[0]): string {
  const explanation = buildTargetExplanation(input)
  return [
    explanation.headline,
    ...explanation.factors.flatMap((f) => [f.title, f.detail]),
    explanation.footnote ?? '',
  ]
    .join(' ')
    .toLowerCase()
}

describe('buildTargetExplanation', () => {
  it('leads with the target actually shown on the card', () => {
    expect(buildTargetExplanation(base).headline).toContain('45')
  })

  it('anchors the explanation on the clean max', () => {
    const factors = buildTargetExplanation(base).factors
    expect(factors.some((f) => f.title.includes('30'))).toBe(true)
  })

  it('names the day type and the position in the block', () => {
    const text = allText(base)
    expect(text).toContain('moderate day')
    expect(text).toContain('week 2 of 4')
  })

  it('describes a deload week qualitatively, never as a percentage', () => {
    const text = allText({
      ...base,
      prescription: prescription({ mesocycleWeek: 4 }),
    })

    expect(text).toContain('deload')
    // The mesocycle percentages only apply on one of two scoring paths, so
    // quoting a number here would be wrong for exactly the best-tracked users.
    expect(text).not.toMatch(/\d+\s*%/)
  })

  it('surfaces ramp-back easing as its own factor', () => {
    // dailyTarget is deliberately lower than prescription.target here — that
    // gap IS the ramp-back easing and must be explained, not hidden.
    const explanation = buildTargetExplanation({
      ...base,
      dailyTarget: 32,
      isRampBack: true,
    })

    expect(explanation.headline).toContain('32')
    expect(explanation.factors.some((f) => f.id === 'ramp-back')).toBe(true)
  })

  it('attributes soreness easing to the wizard answer, not a daily check-in', () => {
    const withSoreness = buildTargetExplanation({ ...base, wizardSorenessLevel: 'notable' })
    const factor = withSoreness.factors.find((f) => f.id === 'soreness')

    expect(factor).toBeTruthy()
    // Today's check-in only gates the max check-in suggestion; saying it moved
    // the target would be a lie the user could disprove.
    expect(factor!.detail).toMatch(/wizard|setup/i)
    expect(factor!.detail.toLowerCase()).not.toContain('today')
  })

  it('says nothing about soreness when the member never reported any', () => {
    expect(buildTargetExplanation(base).factors.some((f) => f.id === 'soreness')).toBe(false)
  })

  it('never claims recent hard sets changed the target', () => {
    // hardFeedbackRate7d is accepted by the engine but never passed, so the
    // damping it controls never fires. Claiming it would be fabrication.
    for (const input of [base, { ...base, wizardSorenessLevel: 'mild' }]) {
      expect(allText(input)).not.toMatch(/hard sets|recent effort|rated hard/)
    }
  })

  it('never presents plan progression notes as the cause of today number', () => {
    expect(allText(base)).not.toMatch(/progression|baseline increased|volume increased/)
  })

  it('explains a rest day without inventing a target', () => {
    const explanation = buildTargetExplanation({
      ...base,
      prescription: prescription({ isRestDay: true, target: 0, sets: 0 }),
      dailyTarget: 0,
    })

    expect(explanation.headline.toLowerCase()).toContain('rest day')
    expect(explanation.factors.some((f) => f.id === 'rest')).toBe(true)
    expect(explanation.factors.some((f) => f.id === 'sets')).toBe(false)
  })

  it('passes a safety cap through verbatim rather than paraphrasing it', () => {
    const note = 'Held at 60 today to stay inside your safe daily volume.'
    const explanation = buildTargetExplanation({
      ...base,
      prescription: prescription({ safetyNote: note }),
    })

    expect(explanation.factors.find((f) => f.id === 'cap')?.detail).toBe(note)
  })

  it('carries the not-medical-advice footnote', () => {
    expect(buildTargetExplanation(base).footnote).toMatch(/not medical advice/i)
  })
})
