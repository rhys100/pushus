import { describe, expect, it } from 'vitest'
import {
  completedLapColorForCount,
  lapColorForCount,
  lapIndexForCount,
  LAP_COLORS,
  MAX_SUPPORTED_REPS,
} from '@/lib/loggerLaps'

describe('logger laps', () => {
  it('supports ten laps up to 100 reps', () => {
    expect(LAP_COLORS).toHaveLength(10)
    expect(MAX_SUPPORTED_REPS).toBe(100)
  })

  it('maps rep counts to the lap being filled', () => {
    expect(lapIndexForCount(0)).toBe(-1)
    expect(lapIndexForCount(1)).toBe(0)
    expect(lapIndexForCount(10)).toBe(0)
    expect(lapIndexForCount(11)).toBe(1)
    expect(lapIndexForCount(20)).toBe(1)
    expect(lapIndexForCount(91)).toBe(9)
    expect(lapIndexForCount(100)).toBe(9)
  })

  it('clamps beyond the supported max to the hottest lap', () => {
    expect(lapIndexForCount(101)).toBe(9)
    expect(lapColorForCount(150)).toBe(LAP_COLORS[9])
  })

  it('ramps from a gentle first lap to a hot last lap', () => {
    expect(lapColorForCount(1)).toBe(LAP_COLORS[0])
    expect(lapColorForCount(100)).toBe(LAP_COLORS[9])
  })

  it('shows the previous completed lap as the base ring only after lap one', () => {
    expect(completedLapColorForCount(0)).toBeNull()
    expect(completedLapColorForCount(10)).toBeNull()
    expect(completedLapColorForCount(11)).toBe(LAP_COLORS[0])
    expect(completedLapColorForCount(20)).toBe(LAP_COLORS[0])
    expect(completedLapColorForCount(21)).toBe(LAP_COLORS[1])
  })
})
