export type OversizeEntryPolicy = 'warn' | 'block' | 'admin_review'
export type EntryReviewStatus = 'none' | 'pending'

export class MaxEntryExceededError extends Error {
  readonly maxSingleEntry: number

  constructor(maxSingleEntry: number) {
    super(`Entry exceeds max_single_entry (${maxSingleEntry})`)
    this.name = 'MaxEntryExceededError'
    this.maxSingleEntry = maxSingleEntry
  }
}

/** Mirrors `public.resolve_oversize_review_status` — client-safe preview of server rules. */
export function resolveOversizeReviewStatus(
  maxSingleEntry: number,
  policy: OversizeEntryPolicy,
  count: number,
): EntryReviewStatus {
  if (count <= maxSingleEntry) {
    return 'none'
  }

  if (policy === 'block') {
    throw new MaxEntryExceededError(maxSingleEntry)
  }

  if (policy === 'admin_review') {
    return 'pending'
  }

  return 'none'
}
