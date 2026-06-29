import { describe, expect, it } from 'vitest'
import {
  getTrainingDayWarnings,
  isLegacyMonSatTrainingDays,
  shouldNormalizeLegacyTrainingDays,
  WIZARD_PREVIEW_LABELS,
} from '../../src/lib/training/wizardUi'

describe('wizardUi', () => {
  it('uses hardest day and suggested sets preview labels', () => {
    expect(WIZARD_PREVIEW_LABELS.hardestDay).toBe('Hardest day this week')
    expect(WIZARD_PREVIEW_LABELS.suggestedSets).toBe('Suggested sets')
    expect(WIZARD_PREVIEW_LABELS.hardestDay).not.toMatch(/Peak day/i)
    expect(WIZARD_PREVIEW_LABELS.suggestedSets).not.toMatch(/Set size/i)
  })

  it('warns on 6 training days', () => {
    const warnings = getTrainingDayWarnings(6, 'moderate')
    expect(warnings.some((w) => /lot of training days/i.test(w))).toBe(true)
  })

  it('warns on intense plus 6 training days', () => {
    const warnings = getTrainingDayWarnings(6, 'intense')
    expect(warnings.some((w) => /Intense \+ 6 training days/i.test(w))).toBe(true)
  })

  it('detects legacy Mon–Sat pattern', () => {
    expect(isLegacyMonSatTrainingDays([1, 2, 3, 4, 5, 6])).toBe(true)
    expect(isLegacyMonSatTrainingDays([1, 2, 3, 5, 6])).toBe(false)
  })

  it('normalizes legacy Mon–Sat only without trusted-volume metadata', () => {
    expect(shouldNormalizeLegacyTrainingDays([1, 2, 3, 4, 5, 6], null)).toBe(true)
    expect(shouldNormalizeLegacyTrainingDays([1, 2, 3, 4, 5, 6], '@vt:partial;mc:0@')).toBe(
      false,
    )
    expect(shouldNormalizeLegacyTrainingDays([1, 2, 3, 5, 6], null)).toBe(false)
  })
})
