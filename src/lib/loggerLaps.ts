/**
 * Circular logger lap colours.
 *
 * Each lap = 10 reps = one full revolution of the ring. As reps climb, the ring
 * fills to a solid colour, then the next lap starts a fresh "snake" in the next
 * colour on top. Colours ramp from gentle/cool (early reps) to hot/powerful
 * (later reps). We support up to 100 reps = 10 laps = 10 colours.
 */
export const LAP_COLORS = [
  '#4f9dff', // lap 1 — calm blue
  '#22c3e6', // lap 2 — cyan
  '#1fd6a6', // lap 3 — teal
  '#3ad35f', // lap 4 — green
  '#a6e22e', // lap 5 — lime
  '#f4d21b', // lap 6 — gold
  '#ffa51f', // lap 7 — amber
  '#ff6b35', // lap 8 — orange (brand accent)
  '#ff3b2e', // lap 9 — red-orange
  '#ff1f57', // lap 10 — hot crimson
] as const

export const REPS_PER_LAP = 10
export const MAX_SUPPORTED_REPS = REPS_PER_LAP * LAP_COLORS.length

/**
 * Zero-based index of the lap a rep count sits in.
 * 0 reps → -1 (no lap). 1–10 → 0, 11–20 → 1, … 91–100 → 9. Clamped at the last
 * lap so counts above the supported max keep the hottest colour.
 */
export function lapIndexForCount(count: number): number {
  if (count <= 0) {
    return -1
  }

  return Math.min(LAP_COLORS.length - 1, Math.ceil(count / REPS_PER_LAP) - 1)
}

/** Colour of the lap currently being filled (defaults to the first lap at 0). */
export function lapColorForCount(count: number): string {
  return LAP_COLORS[Math.max(0, lapIndexForCount(count))]
}

/** Colour of the last fully completed lap shown as a solid base ring, or null. */
export function completedLapColorForCount(count: number): string | null {
  const index = lapIndexForCount(count)

  if (index < 1) {
    return null
  }

  return LAP_COLORS[Math.min(LAP_COLORS.length - 1, index - 1)]
}
