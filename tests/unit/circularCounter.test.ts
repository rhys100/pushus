import { describe, expect, it } from 'vitest'
import {
  angleToTotalCount,
  countToAngle,
  countWithinRevolution,
  CIRCULAR_COUNTER,
  snapAngleToRep,
} from '../../src/lib/circularCounter'

describe('circularCounter', () => {
  it('maps degrees per rep consistently', () => {
    expect(CIRCULAR_COUNTER.degreesPerRep).toBe(36)
    expect(CIRCULAR_COUNTER.repsPerRevolution).toBe(10)
  })

  describe('countWithinRevolution', () => {
    it('returns 1 at 0° and just before 36°', () => {
      expect(countWithinRevolution(0)).toBe(1)
      expect(countWithinRevolution(35)).toBe(1)
    })

    it('steps up every 36° within a revolution', () => {
      expect(countWithinRevolution(36)).toBe(2)
      expect(countWithinRevolution(71)).toBe(2)
      expect(countWithinRevolution(72)).toBe(3)
    })

    it('caps at 10 reps before a full revolution completes', () => {
      expect(countWithinRevolution(324)).toBe(10)
      expect(countWithinRevolution(359)).toBe(10)
    })

    it('normalises angles beyond 360°', () => {
      expect(countWithinRevolution(396)).toBe(2)
      expect(countWithinRevolution(-324)).toBe(2)
    })
  })

  describe('angleToTotalCount', () => {
    it('returns 0 for zero or negative angle', () => {
      expect(angleToTotalCount(0)).toBe(0)
      expect(angleToTotalCount(-10)).toBe(0)
    })

    it('counts partial revolutions', () => {
      expect(angleToTotalCount(1)).toBe(1)
      expect(angleToTotalCount(36)).toBe(2)
      expect(angleToTotalCount(359)).toBe(10)
    })

    it('adds 10 reps per full revolution', () => {
      expect(angleToTotalCount(360)).toBe(10)
      expect(angleToTotalCount(720)).toBe(20)
      expect(angleToTotalCount(750)).toBe(21)
    })

    it('supports multi-revolution totals', () => {
      expect(angleToTotalCount(1080)).toBe(30)
      expect(angleToTotalCount(1116)).toBe(32)
    })
  })

  describe('countToAngle', () => {
    it('returns 0 for zero or negative counts', () => {
      expect(countToAngle(0)).toBe(0)
      expect(countToAngle(-3)).toBe(0)
    })

    it('round-trips with angleToTotalCount', () => {
      for (const count of [1, 2, 9, 10, 11, 20, 32]) {
        expect(angleToTotalCount(countToAngle(count))).toBe(count)
      }
    })

    it('maps lap counts to exact revolution angles', () => {
      expect(countToAngle(10)).toBe(360)
      expect(countToAngle(20)).toBe(720)
    })
  })

  describe('snapAngleToRep', () => {
    it('snaps to slot centre for each rep', () => {
      expect(snapAngleToRep(0)).toBe(0)
      expect(snapAngleToRep(1)).toBe(18)
      expect(snapAngleToRep(35)).toBe(18)
      expect(snapAngleToRep(36)).toBe(54)
      expect(snapAngleToRep(359)).toBe(360)
      expect(snapAngleToRep(360)).toBe(360)
    })
  })
})
