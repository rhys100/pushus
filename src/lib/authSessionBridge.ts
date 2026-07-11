/** Remove refresh tokens written by the retired Safari↔PWA Cache Storage bridge. */
export async function clearLegacyAuthSessionBridge(): Promise<void> {
  if (typeof caches === 'undefined') {
    return
  }

  try {
    await caches.delete('pushus-auth-bridge-v1')
  } catch {
    // ignore
  }
}
