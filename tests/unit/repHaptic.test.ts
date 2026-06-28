import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isRepHapticSupported,
  isRepMajorStop,
  primeRepFeedback,
  pulseRepHapticDelta,
  repHapticPatternForCount,
  REP_MAJOR_STOP_PATTERN,
  REP_NOTCH_MS,
} from '../../src/lib/repHaptic'

describe('repHaptic', () => {
  const vibrate = vi.fn(() => true)

  beforeEach(() => {
    vibrate.mockClear()
    vi.stubGlobal('navigator', { vibrate })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports supported when navigator.vibrate exists', () => {
    expect(isRepHapticSupported()).toBe(true)
  })

  it('uses notch duration for ordinary reps', () => {
    expect(repHapticPatternForCount(3)).toBe(REP_NOTCH_MS)
    expect(isRepMajorStop(3)).toBe(false)
  })

  it('uses major-stop pattern at multiples of 5', () => {
    expect(repHapticPatternForCount(5)).toEqual([...REP_MAJOR_STOP_PATTERN])
    expect(repHapticPatternForCount(10)).toEqual([...REP_MAJOR_STOP_PATTERN])
    expect(isRepMajorStop(5)).toBe(true)
    expect(isRepMajorStop(10)).toBe(true)
  })

  it('vibrates once per rep crossed with the matching pattern', () => {
    pulseRepHapticDelta(2, 6)

    expect(vibrate).toHaveBeenCalledTimes(4)
    expect(vibrate.mock.calls[0]?.[0]).toBe(REP_NOTCH_MS)
    expect(vibrate.mock.calls[1]?.[0]).toBe(REP_NOTCH_MS)
    expect(vibrate.mock.calls[2]?.[0]).toEqual([...REP_MAJOR_STOP_PATTERN])
    expect(vibrate.mock.calls[3]?.[0]).toBe(REP_NOTCH_MS)
  })

  it('does not vibrate when count decreases or is unchanged', () => {
    pulseRepHapticDelta(5, 5)
    pulseRepHapticDelta(5, 3)

    expect(vibrate).not.toHaveBeenCalled()
  })

  it('primeRepFeedback is a safe no-op', () => {
    expect(() => primeRepFeedback()).not.toThrow()
  })
})
