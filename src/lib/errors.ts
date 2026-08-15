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

/**
 * supabase-js surfaces low-level transport failures with these opaque messages
 * (FunctionsFetchError / FunctionsHttpError). They must never reach a toast —
 * map them to a friendly, actionable line instead.
 */
const FRIENDLY_FUNCTIONS_MESSAGE = "Couldn't reach the server. Check your connection and try again."

function friendlyFunctionsMessage(message: string): string | null {
  if (
    message.includes('Failed to send a request to the Edge Function') ||
    message.includes('Edge Function returned a non-2xx status code')
  ) {
    return FRIENDLY_FUNCTIONS_MESSAGE
  }
  return null
}

/** Extract a human-readable message from Error, PostgrestError, or unknown throws. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !isOpaqueErrorMessage(error.message)) {
    return friendlyFunctionsMessage(error.message) ?? error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && !isOpaqueErrorMessage(message)) {
      return friendlyFunctionsMessage(message) ?? message
    }
  }

  return fallback
}
