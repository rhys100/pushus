import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '../../src/lib/errors'

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
