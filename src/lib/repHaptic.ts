/**
 * Per-rep feedback while dragging the circular logger.
 * Patterns from the [Haptic Playground stepped slider](https://haptic-sliders.vercel.app/)
 * via [ios-vibrator-pro-max](https://vibrator.dev/).
 */

/** Stepped-slider notch tick (ms). */
export const REP_NOTCH_MS = 8

/** Stepped-slider major stop every 5 steps — [vibrate, pause, vibrate]. */
export const REP_MAJOR_STOP_PATTERN = [12, 8, 12] as const

export function isRepMajorStop(count: number): boolean {
  return count > 0 && count % 5 === 0
}

export function repHapticPatternForCount(count: number): number | number[] {
  return isRepMajorStop(count) ? [...REP_MAJOR_STOP_PATTERN] : REP_NOTCH_MS
}

export function isRepHapticSupported(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return typeof navigator.vibrate === 'function'
}

/** Reserved for touch-start warm-up; polyfill authorizes on touchend/click. */
export function primeRepFeedback(): void {
  // no-op — ios-vibrator-pro-max hooks global interaction events
}

function pulseRepAtCount(count: number): boolean {
  if (!isRepHapticSupported()) {
    return false
  }

  return navigator.vibrate(repHapticPatternForCount(count))
}

/**
 * Pulse once per rep crossed when count increases (e.g. drag from 3 → 7 → four ticks).
 * Multiples of 5 use the stronger major-stop pattern (5, 10, 15…).
 */
export function pulseRepHapticDelta(prevCount: number, nextCount: number): boolean {
  if (nextCount <= prevCount) {
    return false
  }

  let fired = false

  for (let count = prevCount + 1; count <= nextCount; count += 1) {
    if (pulseRepAtCount(count)) {
      fired = true
    }
  }

  return fired
}
