import { describe, expect, it, vi } from 'vitest'
import { messageFromFunctionsInvokeError } from '../../src/lib/functionsInvokeError'

describe('messageFromFunctionsInvokeError', () => {
  it('returns null when context has no json method (FunctionsFetchError shape)', async () => {
    const error = { message: 'Failed to send a request to the Edge Function', context: new TypeError('fetch failed') }
    await expect(messageFromFunctionsInvokeError(error)).resolves.toBeNull()
  })

  it('returns the server error string from an HTTP Response-like context', async () => {
    const error = {
      message: 'Edge Function returned a non-2xx status code',
      context: {
        json: vi.fn().mockResolvedValue({ error: 'Already nudged today. Try again tomorrow.' }),
      },
    }
    await expect(messageFromFunctionsInvokeError(error)).resolves.toBe(
      'Already nudged today. Try again tomorrow.',
    )
  })

  it('returns null when the body has no usable error field', async () => {
    const error = {
      context: { json: vi.fn().mockResolvedValue({}) },
    }
    await expect(messageFromFunctionsInvokeError(error)).resolves.toBeNull()
  })

  it('returns null when json() rejects', async () => {
    const error = {
      context: { json: vi.fn().mockRejectedValue(new Error('not json')) },
    }
    await expect(messageFromFunctionsInvokeError(error)).resolves.toBeNull()
  })
})
