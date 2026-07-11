import { describe, expect, it } from 'vitest'
import {
  friendlyAuthRedirectError,
  friendlySendEmailError,
  friendlyVerifyEmailError,
} from '@/lib/authEmailErrors'

describe('auth email errors', () => {
  it('maps Supabase SMTP failures to actionable copy', () => {
    expect(
      friendlySendEmailError({
        message: '{}',
        status: 500,
        name: 'AuthRetryableFetchError',
      }),
    ).toContain('SMTP')
  })

  it('maps opaque auth errors without blaming the user network', () => {
    expect(friendlySendEmailError({ message: '{}', status: 400, name: 'AuthError' })).toContain(
      'sign-in email',
    )
  })

  it('keeps invalid-code guidance specific', () => {
    expect(friendlyVerifyEmailError('Token has expired or is invalid')).toContain('invalid or expired')
  })

  it('passes through OAuth redirect errors safely', () => {
    expect(friendlyAuthRedirectError('provider is not enabled')).toContain('Google sign-in')
  })
})
