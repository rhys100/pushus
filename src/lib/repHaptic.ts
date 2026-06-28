/** Short tick per rep while dragging the logger (Android Chrome; no-op on unsupported browsers). */

const REP_TICK_MS = 24
const REP_GAP_MS = 16
const MAX_PATTERN_TICKS = 6

export function isRepHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/**
 * Pulse once per rep crossed when count increases (e.g. drag from 3 → 7 → four ticks).
 */
export function pulseRepHapticDelta(prevCount: number, nextCount: number): void {
  if (!isRepHapticSupported() || nextCount <= prevCount) {
    return
  }

  const delta = nextCount - prevCount

  if (delta === 1) {
    navigator.vibrate(REP_TICK_MS)
    return
  }

  const ticks = Math.min(delta, MAX_PATTERN_TICKS)
  const pattern: number[] = []

  for (let i = 0; i < ticks; i++) {
    pattern.push(REP_TICK_MS, REP_GAP_MS)
  }

  if (pattern.length > 0) {
    pattern.pop()
  }

  navigator.vibrate(pattern)
}
