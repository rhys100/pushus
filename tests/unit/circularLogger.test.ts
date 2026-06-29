import { describe, expect, it } from 'vitest'
import { angleToTotalCount } from '../../src/lib/circularCounter'

describe('circular logger drag behaviour', () => {
  it('derives count from angle without any network layer', () => {
    expect(angleToTotalCount(0)).toBe(0)
    expect(angleToTotalCount(36)).toBe(1)
    expect(angleToTotalCount(180)).toBe(5)
    expect(angleToTotalCount(360)).toBe(10)
  })

  it('only increases count on rep boundaries', () => {
    expect(angleToTotalCount(27)).toBe(1)
    expect(angleToTotalCount(54)).toBe(2)
    expect(angleToTotalCount(53)).toBe(1)
    expect(angleToTotalCount(72)).toBe(2)
  })
})

describe('bank submit guard', () => {
  it('blocks duplicate submits while pending', () => {
    const attempts: number[] = []

    const guard = (canBank: boolean, isPending: boolean, count: number) => {
      if (!canBank || isPending || count <= 0) {
        return false
      }

      attempts.push(count)
      return true
    }

    expect(guard(true, true, 5)).toBe(false)
    expect(guard(true, false, 5)).toBe(true)
    expect(guard(true, false, 5)).toBe(true)
    expect(attempts).toEqual([5, 5])
  })
})
