import { describe, expect, it } from 'vitest'
import {
  OVERAGE_ABSOLUTE_FLOOR,
  shouldConfirmOverage,
  warningCapForDay,
} from '../../src/lib/overageCap'

describe('overageCap', () => {
  describe('warningCapForDay', () => {
    it('never drops below the absolute floor', () => {
      expect(warningCapForDay({ dailyTarget: 20, maxCleanSet: 10 })).toBe(OVERAGE_ABSOLUTE_FLOOR)
      expect(warningCapForDay({ dailyTarget: null, maxCleanSet: null })).toBe(OVERAGE_ABSOLUTE_FLOOR)
    })

    it('scales above the floor for strong plans', () => {
      // dailyVolumeCap(60) = min(120, 75) = 75 → 75 * 1.5 = 112.5 → floor wins (150)
      expect(warningCapForDay({ dailyTarget: 50, maxCleanSet: 60 })).toBe(OVERAGE_ABSOLUTE_FLOOR)
      // dailyVolumeCap(200) = min(400, 215) = 215 → 215 * 1.5 = 322.5 → 323
      expect(warningCapForDay({ dailyTarget: 100, maxCleanSet: 200 })).toBe(323)
    })
  })

  describe('shouldConfirmOverage', () => {
    it('does not prompt during normal training', () => {
      expect(shouldConfirmOverage(40, 20, { dailyTarget: 50, maxCleanSet: 40 })).toBe(false)
    })

    it('prompts once the projected total crosses the cap', () => {
      // cap = 150; 140 + 20 = 160 > 150
      expect(shouldConfirmOverage(140, 20, { dailyTarget: 50, maxCleanSet: 40 })).toBe(true)
    })

    it('is exclusive at the cap boundary', () => {
      // cap = 150; 130 + 20 = 150, not over
      expect(shouldConfirmOverage(130, 20, { dailyTarget: 50, maxCleanSet: 40 })).toBe(false)
    })
  })
})
