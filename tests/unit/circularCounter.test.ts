import { describe, expect, it } from 'vitest'
import {
  angleToTotalCount,
  countToAngle,
  countWithinRevolution,
  CIRCULAR_COUNTER,
  normalizeAngleDelta,
  rawAngleFromPointerDown,
  ringAngleToRawAngle,
  snapAngleToRep,
} from '../../src/lib/circularCounter'

describe('circularCounter', () => {
  it('maps degrees per rep consistently', () => {
    expect(CIRCULAR_COUNTER.degreesPerRep).toBe(36)
    expect(CIRCULAR_COUNTER.repsPerRevolution).toBe(10)
  })

  describe('countWithinRevolution', () => {
    it('returns 0 at 0°', () => {
      expect(countWithinRevolution(0)).toBe(0)
    })

    it('returns 1 near 36°', () => {
      expect(countWithinRevolution(36)).toBe(1)
      expect(countWithinRevolution(27)).toBe(1)
    })

    it('steps up every 36° within a revolution', () => {
      expect(countWithinRevolution(72)).toBe(2)
      expect(countWithinRevolution(54)).toBe(2)
      expect(countWithinRevolution(108)).toBe(3)
    })

    it('anchors rep 5 at bottom (180°)', () => {
      expect(countWithinRevolution(180)).toBe(5)
    })

    it('caps at 10 reps near a full revolution', () => {
      expect(countWithinRevolution(324)).toBe(9)
      expect(countWithinRevolution(351)).toBe(10)
    })

    it('normalises angles beyond 360°', () => {
      expect(countWithinRevolution(396)).toBe(1)
      expect(countWithinRevolution(-324)).toBe(1)
    })
  })

  describe('angleToTotalCount', () => {
    it('returns 0 for zero or negative angle', () => {
      expect(angleToTotalCount(0)).toBe(0)
      expect(angleToTotalCount(-10)).toBe(0)
    })

    it('counts partial revolutions at rep positions', () => {
      expect(angleToTotalCount(36)).toBe(1)
      expect(angleToTotalCount(180)).toBe(5)
      expect(angleToTotalCount(324)).toBe(9)
    })

    it('adds 10 reps per full revolution', () => {
      expect(angleToTotalCount(360)).toBe(10)
      expect(angleToTotalCount(720)).toBe(20)
      expect(angleToTotalCount(396)).toBe(11)
    })

    it('supports multi-revolution totals', () => {
      expect(angleToTotalCount(1080)).toBe(30)
      expect(angleToTotalCount(1116)).toBe(31)
    })
  })

  describe('countToAngle', () => {
    it('returns 0 for zero or negative counts', () => {
      expect(countToAngle(0)).toBe(0)
      expect(countToAngle(-3)).toBe(0)
    })

    it('anchors rep 5 at bottom and rep 10 at top', () => {
      expect(countToAngle(1)).toBe(36)
      expect(countToAngle(5)).toBe(180)
      expect(countToAngle(9)).toBe(324)
      expect(countToAngle(10)).toBe(360)
    })

    it('adds exactly 36° per rep step within a lap', () => {
      for (let rep = 2; rep <= 9; rep++) {
        expect(countToAngle(rep) - countToAngle(rep - 1)).toBe(36)
      }
    })

    it('round-trips with angleToTotalCount', () => {
      for (const count of [1, 2, 5, 9, 10, 11, 20, 31]) {
        expect(angleToTotalCount(countToAngle(count))).toBe(count)
      }
    })

    it('maps lap counts to exact revolution angles', () => {
      expect(countToAngle(10)).toBe(360)
      expect(countToAngle(20)).toBe(720)
      expect(countToAngle(11)).toBe(396)
    })
  })

  describe('snapAngleToRep', () => {
    it('snaps to rep positions on the dial', () => {
      expect(snapAngleToRep(0)).toBe(0)
      expect(snapAngleToRep(27)).toBe(36)
      expect(snapAngleToRep(35)).toBe(36)
      expect(snapAngleToRep(54)).toBe(72)
      expect(snapAngleToRep(180)).toBe(180)
      expect(snapAngleToRep(351)).toBe(360)
      expect(snapAngleToRep(360)).toBe(360)
    })
  })

  describe('rawAngleFromPointerDown', () => {
    it('snaps first-lap touch at 6 o’clock to rep 5', () => {
      expect(rawAngleFromPointerDown(180)).toBe(countToAngle(5))
      expect(angleToTotalCount(rawAngleFromPointerDown(180))).toBe(5)
    })

    it('returns 0 for top-of-ring touch at rest', () => {
      expect(rawAngleFromPointerDown(0)).toBe(0)
    })
  })

  describe('ringAngleToRawAngle', () => {
    it('preserves completed revolutions when jumping on ring', () => {
      const currentRaw = countToAngle(21)
      const jumped = ringAngleToRawAngle(180, currentRaw)

      expect(Math.floor(jumped / 360)).toBe(Math.floor(currentRaw / 360))
      expect(angleToTotalCount(jumped)).toBeGreaterThan(20)
    })

    it('maps twelve o’clock tap to rep 1, not zero, when count is partial', () => {
      const currentRaw = countToAngle(5)
      const jumped = ringAngleToRawAngle(0, currentRaw)

      expect(angleToTotalCount(jumped)).toBe(1)
      expect(jumped).toBe(countToAngle(1))
    })
  })

  describe('normalizeAngleDelta', () => {
    it('wraps large deltas across 12 o’clock', () => {
      expect(normalizeAngleDelta(270)).toBe(-90)
      expect(normalizeAngleDelta(-270)).toBe(90)
      expect(normalizeAngleDelta(45)).toBe(45)
    })
  })
})
