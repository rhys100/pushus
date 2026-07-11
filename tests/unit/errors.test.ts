import { describe, expect, it } from 'vitest'
import { getErrorMessage, isOpaqueErrorMessage } from '../../src/lib/errors'

describe('isOpaqueErrorMessage', () => {
  it('flags blank and stringified-object messages', () => {
    for (const opaque of ['', '   ', '{}', '[]', '[object Object]', '{"code":500}', '[1,2]']) {
      expect(isOpaqueErrorMessage(opaque)).toBe(true)
    }
  })

  it('keeps real sentences', () => {
    for (const real of ['Email rate limit exceeded', 'Signups not allowed for otp', 'Failed to fetch']) {
      expect(isOpaqueErrorMessage(real)).toBe(false)
    }
  })
})

describe('getErrorMessage', () => {
  it('returns Error message', () => {
    expect(getErrorMessage(new Error('Postgres failed'), 'fallback')).toBe('Postgres failed')
  })

  it('returns message from PostgrestError-like object', () => {
    expect(
      getErrorMessage(
        { message: 'invalid input value for enum training_level: "advanced"' },
        'fallback',
      ),
    ).toBe('invalid input value for enum training_level: "advanced"')
  })

  it('returns fallback for unknown shapes', () => {
    expect(getErrorMessage(null, 'Could not save training plan.')).toBe(
      'Could not save training plan.',
    )
  })
})
