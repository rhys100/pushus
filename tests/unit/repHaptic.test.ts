import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { play, getCapabilities, setOutput } = vi.hoisted(() => ({
  play: vi.fn(() => ({ mode: 'audio' as const, haptics: false, audio: true })),
  getCapabilities: vi.fn(() => ({
    haptics: true,
    audio: true,
    ios: false,
    reducedMotion: false,
  })),
  setOutput: vi.fn(),
}))

vi.mock('bzzz', () => ({
  createHaptics: () => ({
    play,
    getCapabilities,
    setOutput,
  }),
}))

import {
  isRepHapticSupported,
  primeRepFeedback,
  pulseRepHapticDelta,
} from '../../src/lib/repHaptic'

describe('repHaptic', () => {
  beforeEach(() => {
    play.mockClear()
    getCapabilities.mockClear()
    setOutput.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports supported when haptics or audio is available', () => {
    vi.stubGlobal('window', {})
    expect(isRepHapticSupported()).toBe(true)
  })

  it('plays repTick for a single rep increase', () => {
    pulseRepHapticDelta(2, 3)

    expect(play).toHaveBeenCalledWith('repTick')
  })

  it('plays a multi-pulse pattern when several reps are crossed', () => {
    pulseRepHapticDelta(1, 4)

    expect(play).toHaveBeenCalledOnce()
    const pattern = play.mock.calls[0]?.[0]
    expect(Array.isArray(pattern)).toBe(true)
    expect(pattern).toHaveLength(5)
  })

  it('does not play when count decreases or is unchanged', () => {
    pulseRepHapticDelta(5, 5)
    pulseRepHapticDelta(5, 3)

    expect(play).not.toHaveBeenCalled()
  })

  it('primes both output channels on touch start', () => {
    primeRepFeedback()

    expect(setOutput).toHaveBeenCalledWith('both')
  })
})
