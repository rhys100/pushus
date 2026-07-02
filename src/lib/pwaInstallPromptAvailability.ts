import type { PwaInstallPlatform } from '@/lib/pwaInstallPrompt'

export const INSTALL_PROMPT_CHECK_MS = 2500

let installPromptAvailable = false
let installPromptCheckComplete = false
const subscribers = new Set<() => void>()

function notify(): void {
  subscribers.forEach((listener) => listener())
}

export function resetInstallPromptAvailabilityCheck(): void {
  installPromptAvailable = false
  installPromptCheckComplete = false
  notify()
}

export function noteInstallPromptAvailable(): void {
  installPromptAvailable = true
  installPromptCheckComplete = true
  notify()
}

export function completeInstallPromptCheckUnavailable(): void {
  if (installPromptCheckComplete) {
    return
  }

  installPromptAvailable = false
  installPromptCheckComplete = true
  notify()
}

export function isInstallPromptCheckComplete(): boolean {
  return installPromptCheckComplete
}

export function isInstallPromptAvailable(): boolean {
  return installPromptAvailable
}

export function isAndroidInstallPromptUnavailable(platform: PwaInstallPlatform): boolean {
  return platform === 'android' && installPromptCheckComplete && !installPromptAvailable
}

export function subscribeInstallPromptAvailability(listener: () => void): () => void {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}
