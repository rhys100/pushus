const RELOAD_ATTEMPT_PREFIX = 'pushus-reload-attempts-'
export const MAX_RELOAD_ATTEMPTS = 3

export async function clearAppCaches(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations.map((registration) =>
        typeof registration.update === 'function'
          ? registration.update().catch(() => undefined)
          : Promise.resolve(),
      ),
    )
  }

  if ('caches' in window) {
    const keys = await window.caches.keys()
    await Promise.all(keys.map((key) => window.caches.delete(key)))
  }
}

export function getReloadAttemptCount(buildId: string): number {
  try {
    const raw = sessionStorage.getItem(`${RELOAD_ATTEMPT_PREFIX}${buildId}`)
    if (!raw) {
      return 0
    }

    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  } catch {
    return 0
  }
}

export function incrementReloadAttempt(buildId: string): number {
  const nextCount = getReloadAttemptCount(buildId) + 1

  try {
    sessionStorage.setItem(`${RELOAD_ATTEMPT_PREFIX}${buildId}`, String(nextCount))
  } catch {
    // Ignore storage failures — reload still works.
  }

  return nextCount
}

export function clearReloadAttempts(buildId: string): void {
  try {
    sessionStorage.removeItem(`${RELOAD_ATTEMPT_PREFIX}${buildId}`)
  } catch {
    // Ignore storage failures.
  }
}

export function shouldStopReloadAttempts(buildId: string): boolean {
  return getReloadAttemptCount(buildId) >= MAX_RELOAD_ATTEMPTS
}

export function confirmAppBuildAfterReload(currentBuildId: string): void {
  const url = new URL(window.location.href)
  const requestedBuild = url.searchParams.get('_v')

  if (!requestedBuild) {
    return
  }

  url.searchParams.delete('_v')
  window.history.replaceState({}, '', url.toString())

  if (requestedBuild === currentBuildId) {
    clearReloadAttempts(requestedBuild)
  }
}

export async function reloadAppForBuild(buildId: string): Promise<void> {
  incrementReloadAttempt(buildId)
  await clearAppCaches()

  const url = new URL(window.location.href)
  url.searchParams.set('_v', buildId)
  window.location.replace(url.toString())
}
