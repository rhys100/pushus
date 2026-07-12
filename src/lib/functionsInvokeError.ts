/**
 * Pull a server `{ error }` message out of a Supabase `functions.invoke` failure.
 *
 * `error.context` is a Fetch `Response` for HTTP/relay failures, but for network
 * failures it is the underlying error object (no `.json`). Calling `.json()`
 * blindly throws TypeError — which was surfacing as the toast for mate nudges.
 */
export async function messageFromFunctionsInvokeError(error: unknown): Promise<string | null> {
  if (!error || typeof error !== 'object') return null

  const context = (error as { context?: unknown }).context
  if (
    !context ||
    typeof context !== 'object' ||
    typeof (context as { json?: unknown }).json !== 'function'
  ) {
    return null
  }

  const body = (await (context as { json: () => Promise<unknown> })
    .json()
    .catch(() => null)) as { error?: string } | null

  return typeof body?.error === 'string' && body.error.trim() ? body.error : null
}
