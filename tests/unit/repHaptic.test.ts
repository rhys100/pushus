import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRepHapticSupported, pulseRepHapticDelta } from '../../src/lib/repHaptic'

describe('repHaptic', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports unsupported when vibrate is missing', () => {
    vi.stubGlobal('navigator', {})
    expect(isRepHapticSupported()).toBe(false)
  })

  it('double-pulse when count increases by one', () => {
    const vibrate = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { vibrate })

    pulseRepHapticDelta(2, 3)

    expect(vibrate).toHaveBeenCalledWith([60, 20, 35])
  })

  it('pattern when multiple reps crossed', () => {
    const vibrate = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { vibrate })

    pulseRepHapticDelta(1, 4)

    expect(vibrate).toHaveBeenCalledWith([60, 30, 60, 30, 60])
  })

  it('does not vibrate when count decreases or unchanged', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })

    pulseRepHapticDelta(5, 5)
    pulseRepHapticDelta(5, 3)

    expect(vibrate).not.toHaveBeenCalled()
  })
})
