import { describe, expect, it } from 'vitest'
import {
  MaxEntryExceededError,
  resolveOversizeReviewStatus,
} from '../../src/lib/maxEntryPolicy'

describe('maxEntryPolicy', () => {
  const max = 50

  it('returns none when count is within limit', () => {
    expect(resolveOversizeReviewStatus(max, 'warn', 50)).toBe('none')
    expect(resolveOversizeReviewStatus(max, 'block', 10)).toBe('none')
  })

  it('warn policy allows oversize entries without review', () => {
    expect(resolveOversizeReviewStatus(max, 'warn', 51)).toBe('none')
  })

  it('block policy throws when count exceeds max', () => {
    expect(() => resolveOversizeReviewStatus(max, 'block', 51)).toThrow(MaxEntryExceededError)
    expect(() => resolveOversizeReviewStatus(max, 'block', 51)).toThrow(
      /max_single_entry \(50\)/,
    )
  })

  it('admin_review policy returns pending for oversize entries', () => {
    expect(resolveOversizeReviewStatus(max, 'admin_review', 51)).toBe('pending')
  })
})
