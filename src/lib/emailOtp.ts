export const EMAIL_OTP_LENGTH = 6

/** Keep only digits so pasted codes with spaces still work. */
export function normalizeEmailOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH)
}

export function isCompleteEmailOtp(value: string): boolean {
  return normalizeEmailOtp(value).length === EMAIL_OTP_LENGTH
}
