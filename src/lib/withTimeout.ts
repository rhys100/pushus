/** Race a promise against a timeout. Resolves `fallback` when the timer wins. */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}
