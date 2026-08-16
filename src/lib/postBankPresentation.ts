import { shouldAskEffortFeedback, type EffortRating } from '@/lib/training/effortRating'
import { shouldPromptSorenessCheckIn } from '@/lib/training/sorenessCheckin'

/**
 * Decides what — if anything — the app shows the moment after a set is banked.
 *
 * Several features want this moment: the effort ask, the soreness check-in, a
 * next-set nudge, a personal-record celebration, and the Undo toast. They were
 * each solving the collision separately, and the three sheets that already
 * exist share a z-index and avoid each other only by luck of their predicates.
 *
 * So one owner: everything post-bank is resolved here into an ORDERED QUEUE,
 * and the page shows one step at a time. Two rules make that safe:
 *
 *  - the queue is decided once, from a snapshot taken at bank time, so a
 *    refetch landing mid-sheet cannot change what is on screen;
 *  - anything that invalidates the bank (Undo, switching activity, entering
 *    nose-tap mode) clears the whole queue rather than one sheet.
 */

export type PostBankStep =
  | { kind: 'prCelebration'; count: number; previousBest: number }
  | { kind: 'effort'; entryId: string }
  | { kind: 'soreness' }
  | { kind: 'nextSet'; setNumber: number; setsPlanned: number; nextTarget: number }

export type PostBankContext = {
  /** Reps in the set just banked. */
  count: number
  /**
   * Server entry id. Null for a set queued offline — the effort ask writes
   * against a real row, so it cannot run until the set has synced.
   */
  entryId: string | null
  isTrainingDay: boolean
  wizardCompleted: boolean
  isRestDay: boolean
  dayType: string
  /** Banks logged today INCLUDING the one just banked. */
  banksLogged: number
  setsPlanned: number
  setSize: number
  effortAskedToday: boolean
  alreadyCheckedInToday: boolean
  /** Best single set before this one; used only to detect a new record. */
  previousBestSet: number
  /** Off by default — a nudge is opt-in, never a default nag. */
  nextSetRemindersEnabled: boolean
}

function isOptimistic(entryId: string | null): boolean {
  return !entryId || entryId.startsWith('optimistic-') || entryId.startsWith('queued-')
}

export function isPersonalRecord(count: number, previousBestSet: number): boolean {
  // A first-ever set is not a "record" — there is nothing to have beaten.
  return previousBestSet > 0 && count > previousBestSet
}

export function resolvePostBankSteps(ctx: PostBankContext): PostBankStep[] {
  const steps: PostBankStep[] = []

  if (isPersonalRecord(ctx.count, ctx.previousBestSet)) {
    steps.push({
      kind: 'prCelebration',
      count: ctx.count,
      previousBest: ctx.previousBestSet,
    })
  }

  const effortDue =
    ctx.isTrainingDay &&
    !isOptimistic(ctx.entryId) &&
    shouldAskEffortFeedback({
      wizardCompleted: ctx.wizardCompleted,
      isRestDay: ctx.isRestDay,
      banksLogged: ctx.banksLogged,
      setsPlanned: ctx.setsPlanned,
      effortAskedToday: ctx.effortAskedToday,
      dayType: ctx.dayType,
    })

  if (effortDue) {
    // Non-null: isOptimistic() already rejected null.
    steps.push({ kind: 'effort', entryId: ctx.entryId! })
  } else if (
    // Preserved verbatim from the previous inline chain: the soreness sheet
    // only appears DIRECTLY when the effort ask did not. Otherwise it can
    // still follow a "hard" rating — see sorenessStepAfterEffort.
    ctx.dayType === 'challenge' &&
    ctx.banksLogged >= ctx.setsPlanned &&
    shouldPromptSorenessCheckIn({
      wasChallengeDay: true,
      lastEffortWasHard: false,
      alreadyCheckedInToday: ctx.alreadyCheckedInToday,
    })
  ) {
    steps.push({ kind: 'soreness' })
  }

  // Strictly the complement of the effort ask: that fires once the day's sets
  // are done, this only while sets remain. They can never both apply.
  if (
    ctx.nextSetRemindersEnabled &&
    !ctx.isRestDay &&
    ctx.setsPlanned > 0 &&
    ctx.banksLogged < ctx.setsPlanned
  ) {
    steps.push({
      kind: 'nextSet',
      setNumber: ctx.banksLogged + 1,
      setsPlanned: ctx.setsPlanned,
      nextTarget: ctx.setSize,
    })
  }

  return steps
}

/**
 * A "hard" rating on a challenge day earns a soreness check-in. Kept separate
 * because it depends on an answer that does not exist at bank time.
 */
export function sorenessStepAfterEffort(
  rating: EffortRating,
  ctx: Pick<PostBankContext, 'dayType' | 'alreadyCheckedInToday'>,
): PostBankStep | null {
  const prompt = shouldPromptSorenessCheckIn({
    wasChallengeDay: ctx.dayType === 'challenge',
    lastEffortWasHard: rating === 'hard',
    alreadyCheckedInToday: ctx.alreadyCheckedInToday,
  })

  // Matches the previous behaviour: only a HARD rating on a CHALLENGE day
  // escalated to the check-in.
  return prompt && rating === 'hard' && ctx.dayType === 'challenge'
    ? { kind: 'soreness' }
    : null
}
