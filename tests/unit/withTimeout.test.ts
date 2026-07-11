import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTimeout, withTimeoutReject } from '@/lib/withTimeout'

afterEach(() => {
  vi.useRealTimers()
})

describe('withTimeout', () => {
  it('returns the promise value when it settles first', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1_000, 'fallback')).resolves.toBe('ok')
  })

  it('returns the fallback when the promise hangs past the timeout', async () => {
    vi.useFakeTimers()
    const hung = new Promise<string>(() => {})
    const pending = withTimeout(hung, 500, 'fallback')
    await vi.advanceTimersByTimeAsync(500)
    await expect(pending).resolves.toBe('fallback')
  })

  it('rejects a hung operation when the caller needs an error state', async () => {
    vi.useFakeTimers()
    const pending = withTimeoutReject(new Promise<string>(() => {}), 500, 'Timed out')
    const expectation = expect(pending).rejects.toThrow('Timed out')
    await vi.advanceTimersByTimeAsync(500)
    await expectation
  })
})
