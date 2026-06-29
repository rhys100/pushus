/** Max-clean check-in and plan update helpers. */

export const MAX_CLEAN_JUMP_PERCENT = 0.1

export function capPlanMaxUpdate(planMax: number, observedMax: number): number {
  const jump = observedMax - planMax
  if (jump <= 0) return planMax
  const maxAllowed = Math.max(1, Math.ceil(planMax * MAX_CLEAN_JUMP_PERCENT))
  return planMax + Math.min(jump, maxAllowed)
}

export function shouldPromptPlanMaxUpdate(planMax: number, observedMax: number): boolean {
  return observedMax > planMax
}
