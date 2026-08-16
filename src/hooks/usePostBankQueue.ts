import { useCallback, useState } from 'react'
import type { EffortRating } from '@/lib/training/effortRating'
import {
  resolvePostBankSteps,
  sorenessStepAfterEffort,
  type PostBankContext,
  type PostBankStep,
} from '@/lib/postBankPresentation'

/**
 * Owns the post-bank presentation queue: exactly one step is on screen at a
 * time, and everything that invalidates the bank clears the lot.
 *
 * The queue is the single reason the Today screen can grow more post-bank UI
 * without sheets fighting over z-index.
 */
export function usePostBankQueue() {
  const [queue, setQueue] = useState<PostBankStep[]>([])

  const current = queue[0] ?? null

  /** Called after a successful bank with a snapshot of the day's state. */
  const start = useCallback((context: PostBankContext) => {
    setQueue(resolvePostBankSteps(context))
  }, [])

  /** Finish the current step and reveal the next, if any. */
  const advance = useCallback(() => {
    setQueue((steps) => steps.slice(1))
  }, [])

  /**
   * Undo, switching activity, or entering nose-tap mode all invalidate the set
   * the queue is about — drop every step, not just the visible one.
   */
  const clear = useCallback(() => {
    setQueue([])
  }, [])

  /**
   * A "hard" rating can escalate to the soreness check-in. Replaces the effort
   * step rather than appending, so the check-in shows next instead of behind
   * whatever else was queued.
   */
  const resolveEffort = useCallback(
    (rating: EffortRating, context: Pick<PostBankContext, 'dayType' | 'alreadyCheckedInToday'>) => {
      const followUp = sorenessStepAfterEffort(rating, context)

      setQueue((steps) => {
        const rest = steps.slice(1)
        return followUp ? [followUp, ...rest] : rest
      })
    },
    [],
  )

  return { current, start, advance, clear, resolveEffort }
}
