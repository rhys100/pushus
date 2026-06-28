/**
 * Per-rep feedback while dragging the circular logger.
 * Uses [bzzz](https://pavlito.github.io/bzzz/) — native haptics when available, audio fallback otherwise.
 */

import { createHaptics, type PatternBlock } from 'bzzz'

const MAX_PATTERN_TICKS = 6

const repFeedback = createHaptics({
  output: 'both',
  patterns: {
    repTick: [
      { type: 'pulse', duration: 10, intensity: 0.55 },
      { type: 'gap', duration: 14 },
      { type: 'pulse', duration: 12, intensity: 0.7 },
    ],
  },
})

export function isRepHapticSupported(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const caps = repFeedback.getCapabilities()
  return caps.haptics || caps.audio
}

/** Warm audio output on first touch so drag ticks can play during touchmove. */
export function primeRepFeedback(): void {
  repFeedback.setOutput('both')
}

function buildMultiRepPattern(ticks: number): PatternBlock[] {
  const count = Math.min(ticks, MAX_PATTERN_TICKS)
  const pattern: PatternBlock[] = []

  for (let i = 0; i < count; i++) {
    pattern.push({ type: 'pulse', duration: 10, intensity: 0.5 + i * 0.08 })

    if (i < count - 1) {
      pattern.push({ type: 'gap', duration: 18 })
    }
  }

  return pattern
}

/**
 * Pulse once per rep crossed when count increases (e.g. drag from 3 → 7 → four ticks).
 */
export function pulseRepHapticDelta(prevCount: number, nextCount: number): boolean {
  if (nextCount <= prevCount) {
    return false
  }

  const delta = nextCount - prevCount
  const result =
    delta === 1 ? repFeedback.play('repTick') : repFeedback.play(buildMultiRepPattern(delta))

  return result.haptics || result.audio
}
