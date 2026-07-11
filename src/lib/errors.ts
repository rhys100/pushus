/**
 * True when a message carries no meaning for a human — blank, a stringified
 * object/array ("{}", "[object Object]", a serialized error), etc. These leak
 * out when a fetch returns a non-JSON/empty body (e.g. a CORS/proxy intercept)
 * and must never be shown; callers fall back to a friendly line instead.
 */
export function isOpaqueErrorMessage(message: string | null | undefined): boolean {
  const trimmed = (message ?? '').trim()
  if (trimmed === '' || trimmed === '{}' || trimmed === '[]') {
    return true
  }
  if (/^\[object [A-Za-z]+\]$/.test(trimmed)) {
    return true
  }
  // A bare JSON object/array blob rather than a sentence.
  return /^[{[]/.test(trimmed) && /[}\]]$/.test(trimmed)
}

/** Extract a human-readable message from Error, PostgrestError, or unknown throws. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !isOpaqueErrorMessage(error.message)) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && !isOpaqueErrorMessage(message)) {
      return message
    }
  }

  return fallback
}
