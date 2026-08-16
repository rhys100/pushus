import { describe, expect, it } from 'vitest'
import {
  classifyFlushError,
  isExpiredQueued,
  makeQueuedId,
  MAX_FLUSH_ATTEMPTS,
  queuedDayTotal,
  queuedForGroupDay,
  queuedToPushupEntry,
  QUEUED_EXPIRY_HOURS,
  shouldKeepAfterFailure,
  type QueuedBank,
} from '@/lib/offlineBankQueue'

function queued(overrides: Partial<QueuedBank> = {}): QueuedBank {
  return {
    id: 'queued-1',
    groupId: 'group-1',
    userId: 'user-1',
    count: 20,
    loggedFor: '2026-08-16',
    queuedAt: '2026-08-16T09:00:00.000Z',
    attempts: 0,
    isMaxCheckin: false,
    ...overrides,
  }
}

describe('queued totals', () => {
  const queue = [
    queued({ id: 'a', count: 20 }),
    queued({ id: 'b', count: 15 }),
    queued({ id: 'c', count: 99, loggedFor: '2026-08-15' }),
    queued({ id: 'd', count: 50, groupId: 'group-2' }),
  ]

  it('sums only the given group and day', () => {
    expect(queuedDayTotal(queue, 'group-1', '2026-08-16')).toBe(35)
  })

  it('does not leak another group into the total', () => {
    expect(queuedDayTotal(queue, 'group-2', '2026-08-16')).toBe(50)
  })

  it('keeps yesterday out of today', () => {
    expect(queuedForGroupDay(queue, 'group-1', '2026-08-15')).toHaveLength(1)
  })

  it('is zero for a group with nothing queued', () => {
    expect(queuedDayTotal(queue, 'group-3', '2026-08-16')).toBe(0)
  })
})

describe('queuedToPushupEntry', () => {
  it('keeps the id recognisable as local', () => {
    // The post-bank queue and the entry list both key off this prefix to know
    // there is no server row yet.
    expect(queuedToPushupEntry(queued()).id.startsWith('queued-')).toBe(true)
    expect(makeQueuedId(1, 0.5).startsWith('queued-')).toBe(true)
  })

  it('preserves the pinned logged_for rather than deriving one', () => {
    const entry = queuedToPushupEntry(queued({ loggedFor: '2026-08-15' }))
    expect(entry.logged_for).toBe('2026-08-15')
  })

  it('produces a row the day list can render', () => {
    const entry = queuedToPushupEntry(queued({ count: 20 }))
    expect(entry.count).toBe(20)
    expect(entry.deleted_at).toBeNull()
    expect(entry.review_status).toBe('none')
  })
})

describe('expiry', () => {
  const queuedAt = Date.parse('2026-08-16T09:00:00.000Z')

  it('keeps a set queued within the window', () => {
    expect(isExpiredQueued(queued(), queuedAt + 3_600_000)).toBe(false)
  })

  it('drops a set past the window', () => {
    // The default backdate policy is today-or-yesterday, so an older set would
    // be refused forever — holding it just means a permanent failing item.
    expect(isExpiredQueued(queued(), queuedAt + (QUEUED_EXPIRY_HOURS + 1) * 3_600_000)).toBe(true)
  })

  it('treats an unparseable timestamp as expired rather than immortal', () => {
    expect(isExpiredQueued(queued({ queuedAt: 'not a date' }), queuedAt)).toBe(true)
  })
})

describe('classifyFlushError', () => {
  // The distinction that matters: a transport failure probably never reached
  // the server and is worth retrying; a refusal will refuse identically forever.
  it.each([
    'Failed to fetch',
    'NetworkError when attempting to fetch resource',
    'timeout of 5000ms exceeded',
    '',
  ])('retries the transport failure %j', (message) => {
    expect(classifyFlushError(new Error(message))).toBe('retry')
  })

  it.each([
    'Backdating not allowed for this group',
    'new row violates row-level security policy',
    'Active group membership required',
    'Authentication required',
  ])('drops the permanent refusal %j', (message) => {
    expect(classifyFlushError(new Error(message))).toBe('drop')
  })

  it('handles a Supabase error object rather than an Error', () => {
    expect(classifyFlushError({ message: 'Backdating not allowed' })).toBe('drop')
    expect(classifyFlushError(null)).toBe('retry')
  })
})

describe('shouldKeepAfterFailure', () => {
  it('never keeps a permanently refused set', () => {
    expect(shouldKeepAfterFailure(queued({ attempts: 0 }), 'drop')).toBe(false)
  })

  it('keeps a retryable set until the attempt cap', () => {
    expect(shouldKeepAfterFailure(queued({ attempts: 0 }), 'retry')).toBe(true)
    expect(shouldKeepAfterFailure(queued({ attempts: MAX_FLUSH_ATTEMPTS - 2 }), 'retry')).toBe(true)
  })

  it('gives up at the cap rather than retrying forever', () => {
    expect(shouldKeepAfterFailure(queued({ attempts: MAX_FLUSH_ATTEMPTS - 1 }), 'retry')).toBe(false)
  })
})
