import { dailyVolumeCap } from '@/lib/training/planEngine'

/**
 * Daily overage cap — a calm health guard, not a hard limit. The locked rules
 * (docs/product-decisions.md → Daily goal and safety cap): bank freely up to
 * the goal, extra reps allowed within a soft cap, and above a warning cap show
 * a calm (non-medical) confirmation the user can override.
 *
 * The stored per-plan columns default to placeholder values, so the cap is
 * derived from the plan's safe daily volume instead, with an absolute floor so
 * it never nags during normal training.
 */

/** Never prompt below this daily total, whatever the plan says. */
export const OVERAGE_ABSOLUTE_FLOOR = 150

export type OverageInputs = {
  dailyTarget: number | null
  maxCleanSet: number | null | undefined
}

/** The warning cap: a big-day ceiling above which we gently confirm. */
export function warningCapForDay({ dailyTarget, maxCleanSet }: OverageInputs): number {
  const base = maxCleanSet
    ? dailyVolumeCap(maxCleanSet)
    : Math.max((dailyTarget ?? 0) * 2, 0)
  return Math.max(OVERAGE_ABSOLUTE_FLOOR, Math.round(base * 1.5))
}

/**
 * True when banking `bankedCount` on top of `alreadyBankedToday` would cross the
 * warning cap — i.e. we should show the calm confirmation before logging.
 */
export function shouldConfirmOverage(
  alreadyBankedToday: number,
  bankedCount: number,
  inputs: OverageInputs,
): boolean {
  const projected = alreadyBankedToday + bankedCount
  return projected > warningCapForDay(inputs)
}
