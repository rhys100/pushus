import type { PushupEntry } from '@/types/pushupEntry'

/**
 * Sets banked with no connection, held locally until they can be synced.
 *
 * Uses localStorage rather than IndexedDB, matching src/lib/guestLog.ts — the
 * payload is a handful of small records, and synchronous reads keep the day
 * total honest on the very first render after a reload instead of flashing a
 * lower number while an async store opens.
 *
 * The pure half is exported separately from the storage half so vitest (which
 * runs in a node environment with no localStorage) can exercise the logic.
 */

const QUEUE_KEY = 'pushus_offline_bank_queue'

/** Runaway guard, mirroring MAX_GUEST_ENTRIES. */
const MAX_QUEUED = 200

/**
 * Queued sets older than this are dropped unsynced. The default backdate policy
 * is today-or-yesterday, so anything older will be refused by the server anyway
 * — holding it forever would just mean a permanent failing item.
 */
export const QUEUED_EXPIRY_HOURS = 48

/** Stop retrying an item that keeps failing rather than hammering the RPC. */
export const MAX_FLUSH_ATTEMPTS = 5

export type QueuedBank = {
  id: string
  groupId: string
  userId: string
  count: number
  /**
   * Pinned when the set was banked, in the GROUP's timezone. Recomputing it at
   * flush time would silently move a set banked at 23:55 into the next day.
   */
  loggedFor: string
  queuedAt: string
  attempts: number
  isMaxCheckin: boolean
}

export function makeQueuedId(now: number, seed: number): string {
  // Prefixed so the post-bank queue and the entry list can both recognise a
  // local row that has no server id yet.
  return `queued-${now}-${Math.floor(seed * 1e6).toString(36)}`
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function queuedForGroupDay(
  queue: readonly QueuedBank[],
  groupId: string,
  loggedFor: string,
): QueuedBank[] {
  return queue.filter((item) => item.groupId === groupId && item.loggedFor === loggedFor)
}

export function queuedDayTotal(
  queue: readonly QueuedBank[],
  groupId: string,
  loggedFor: string,
): number {
  return queuedForGroupDay(queue, groupId, loggedFor).reduce((sum, item) => sum + item.count, 0)
}

/** Render a queued set in the same shape the day list expects. */
export function queuedToPushupEntry(item: QueuedBank): PushupEntry {
  return {
    id: item.id,
    group_id: item.groupId,
    user_id: item.userId,
    count: item.count,
    logged_for: item.loggedFor,
    logged_at: item.queuedAt,
    is_backdated: false,
    review_status: 'none',
    source: 'circle_logger',
    reps_in_reserve: null,
    deleted_at: null,
    created_at: item.queuedAt,
    updated_at: item.queuedAt,
  }
}

export function isExpiredQueued(item: QueuedBank, now: number): boolean {
  const queuedAt = Date.parse(item.queuedAt)
  if (Number.isNaN(queuedAt)) {
    return true
  }

  return now - queuedAt > QUEUED_EXPIRY_HOURS * 3_600_000
}

export type FlushOutcome = 'retry' | 'drop'

/**
 * Decide what to do with a queued set whose flush failed.
 *
 * The distinction that matters: a transport failure means the set was probably
 * never recorded and is worth retrying, whereas the server refusing it (most
 * often the group's backdate policy, once the set's day has passed) will refuse
 * it identically forever.
 */
export function classifyFlushError(error: unknown): FlushOutcome {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ((error as { message?: string } | null)?.message ?? '')

  const text = message.toLowerCase()

  const permanent = [
    'backdat',
    'not allowed',
    'permission',
    // Postgres phrases an RLS refusal as "violates row-level security policy",
    // which contains none of the words above — without this it would be
    // retried to the attempt cap and never succeed.
    'row-level security',
    'violates',
    'membership required',
    'authentication',
    'not authorized',
    'forbidden',
  ]

  if (permanent.some((phrase) => text.includes(phrase))) {
    return 'drop'
  }

  return 'retry'
}

export function shouldKeepAfterFailure(item: QueuedBank, outcome: FlushOutcome): boolean {
  return outcome === 'retry' && item.attempts + 1 < MAX_FLUSH_ATTEMPTS
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function parseQueue(raw: string | null): QueuedBank[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item): item is QueuedBank =>
        Boolean(item) &&
        typeof (item as QueuedBank).id === 'string' &&
        typeof (item as QueuedBank).groupId === 'string' &&
        typeof (item as QueuedBank).loggedFor === 'string' &&
        typeof (item as QueuedBank).count === 'number',
    )
  } catch {
    return []
  }
}

export function readQueue(): QueuedBank[] {
  try {
    return parseQueue(localStorage.getItem(QUEUE_KEY))
  } catch {
    return []
  }
}

export function writeQueue(queue: readonly QueuedBank[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED)))
  } catch {
    // Storage full or disabled — the set is lost rather than crashing the bank.
  }
}

export function enqueueBank(
  input: Omit<QueuedBank, 'id' | 'queuedAt' | 'attempts'>,
): QueuedBank {
  const now = Date.now()
  const item: QueuedBank = {
    ...input,
    id: makeQueuedId(now, Math.random()),
    queuedAt: new Date(now).toISOString(),
    attempts: 0,
  }

  writeQueue([...readQueue(), item])
  return item
}

export function removeQueued(id: string): QueuedBank[] {
  const next = readQueue().filter((item) => item.id !== id)
  writeQueue(next)
  return next
}

export function replaceQueue(queue: readonly QueuedBank[]): void {
  writeQueue(queue)
}

/** Drop anything too old to be accepted before showing or flushing. */
export function pruneExpired(now = Date.now()): QueuedBank[] {
  const queue = readQueue()
  const kept = queue.filter((item) => !isExpiredQueued(item, now))

  if (kept.length !== queue.length) {
    writeQueue(kept)
  }

  return kept
}
