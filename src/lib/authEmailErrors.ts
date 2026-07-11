import type { AuthError } from '@supabase/supabase-js'
import { isOpaqueErrorMessage } from '@/lib/errors'

function normaliseMessage(message?: string): string {
  const trimmed = message?.trim() ?? ''
  if (isOpaqueErrorMessage(trimmed)) {
    return ''
  }
  return trimmed
}

/** User-facing copy when signInWithOtp fails. */
export function friendlySendEmailError(error: AuthError | null): string {
  const message = normaliseMessage(error?.message)
  const lower = message.toLowerCase()

  if (error?.status === 500 || lower.includes('magic link email') || lower.includes('unexpected_failure')) {
    return 'Could not send the sign-in email. Email delivery is misconfigured on the server — check SMTP settings and try again.'
  }
  if (lower.includes('provider') && lower.includes('not enabled')) {
    return 'Google sign-in is not enabled on this deployment. Use an email code instead.'
  }
  if (lower.includes('oauth') || lower.includes('google')) {
    return 'Google sign-in could not be completed. Try an email code instead.'
  }
  if (lower.includes('rate') || lower.includes('seconds')) {
    return 'Wait a minute before requesting another sign-in email.'
  }
  if (message) {
    return message
  }
  return 'Could not send the sign-in email. Check your connection and try again.'
}

/** User-facing copy for OAuth / URL auth errors on the login page. */
export function friendlyAuthRedirectError(message: string): string {
  return friendlySendEmailError({ message, status: undefined } as AuthError)
}

/** User-facing copy when verifyOtp fails. */
export function friendlyVerifyEmailError(message?: string): string {
  const normalised = normaliseMessage(message)
  const lower = normalised.toLowerCase()
  if (lower.includes('token') || lower.includes('expired') || lower.includes('invalid')) {
    return 'That code is invalid or expired. Request a new email and try again.'
  }
  return 'Could not verify the code. Check your connection and try again.'
}
