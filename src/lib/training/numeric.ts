/** Small shared numeric helpers for the training-plan lib. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function roundReps(value: number): number {
  return Math.max(0, Math.round(value))
}
