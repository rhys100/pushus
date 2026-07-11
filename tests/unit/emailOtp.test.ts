import { describe, expect, it } from 'vitest'
import { EMAIL_OTP_LENGTH, isCompleteEmailOtp, normalizeEmailOtp } from '@/lib/emailOtp'

describe('email OTP input', () => {
  it('keeps six digits and strips spaces or punctuation from pasted codes', () => {
    expect(normalizeEmailOtp(' 12 34-56 ')).toBe('123456')
    expect(EMAIL_OTP_LENGTH).toBe(6)
  })

  it('caps extra digits and rejects incomplete codes', () => {
    expect(normalizeEmailOtp('12345678')).toBe('123456')
    expect(isCompleteEmailOtp('12345')).toBe(false)
    expect(isCompleteEmailOtp('123 456')).toBe(true)
  })
})
