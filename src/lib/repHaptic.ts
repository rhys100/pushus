/**
 * Per-rep feedback while dragging the circular logger.
 * Patterns from the [Haptic Playground stepped slider](https://haptic-sliders.vercel.app/)
 * via [ios-vibrator-pro-max](https://vibrator.dev/).
 */

/** Stepped-slider notch tick (ms) — ordinary reps. */
export const REP_NOTCH_MS = 18

/** Half-lap stop at 5, 15, 25… — [vibrate, pause, vibrate]. */
export const REP_HALF_LAP_STOP_PATTERN = [24, 12, 24] as const

/** Full lap at 10, 20, 30… — triple pulse, strongest tier. */
export const REP_LAP_STOP_PATTERN = [28, 14, 28, 14, 28] as const

/** @deprecated Use REP_HALF_LAP_STOP_PATTERN */
export const REP_MAJOR_STOP_PATTERN = REP_HALF_LAP_STOP_PATTERN

export function isRepLapStop(count: number): boolean {
  return count > 0 && count % 10 === 0
}

export function isRepHalfLapStop(count: number): boolean {
  return count > 0 && count % 5 === 0 && count % 10 !== 0
}

/** @deprecated Use isRepHalfLapStop */
export function isRepMajorStop(count: number): boolean {
  return isRepHalfLapStop(count) || isRepLapStop(count)
}

export function repHapticPatternForCount(count: number): number | number[] {
  if (isRepLapStop(count)) {
    return [...REP_LAP_STOP_PATTERN]
  }

  if (isRepHalfLapStop(count)) {
    return [...REP_HALF_LAP_STOP_PATTERN]
  }

  return REP_NOTCH_MS
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
 * Reps 5/15/… use half-lap pattern; 10/20/… use strongest lap pattern.
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
