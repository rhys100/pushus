/** Per-rep tick while dragging the logger (Android Chrome; no-op on unsupported browsers). */

const REP_TICK_MS = 60
const REP_GAP_MS = 30
const REP_ECHO_MS = 35
const REP_ECHO_GAP_MS = 20
const MAX_PATTERN_TICKS = 6

export function isRepHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

function vibratePattern(pattern: number | number[]): boolean {
  if (!isRepHapticSupported()) {
    return false
  }

  try {
    return navigator.vibrate(pattern)
  } catch {
    return false
  }
}

/**
 * Pulse once per rep crossed when count increases (e.g. drag from 3 → 7 → four ticks).
 * Uses a double-pulse for single reps — many Android motors ignore very short vibrations.
 */
export function pulseRepHapticDelta(prevCount: number, nextCount: number): boolean {
  if (nextCount <= prevCount) {
    return false
  }

  const delta = nextCount - prevCount

  if (delta === 1) {
    return vibratePattern([REP_TICK_MS, REP_ECHO_GAP_MS, REP_ECHO_MS])
  }

  const ticks = Math.min(delta, MAX_PATTERN_TICKS)
  const pattern: number[] = []

  for (let i = 0; i < ticks; i++) {
    pattern.push(REP_TICK_MS, REP_GAP_MS)
  }

  if (pattern.length > 0) {
    pattern.pop()
  }

  return vibratePattern(pattern)
}
