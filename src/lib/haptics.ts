/**
 * Light UI haptics for buttons, tabs and toggles. Per-rep logger patterns
 * live in repHaptic.ts — these are the quieter, everywhere ticks.
 * iOS support comes from the ios-vibrator-pro-max polyfill loaded in main.tsx.
 */

function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false
  }

  return navigator.vibrate(pattern)
}

/** Crisp single tick — button presses, tab taps, segment switches. */
export function tapHaptic(): boolean {
  return vibrate(10)
}

/** Slightly firmer double tick — selections that change what's on screen. */
export function selectHaptic(): boolean {
  return vibrate([12, 24, 12])
}

/** Rising triple — goals hit, positive confirmations. */
export function successHaptic(): boolean {
  return vibrate([16, 30, 20, 30, 28])
}
