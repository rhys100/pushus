import { useCallback, useState } from 'react'

const STORAGE_KEY = 'pushus.nose-hold-hint-v1'

export function isNoseHoldHintDismissed(): boolean {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissNoseHoldHint(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Ignore storage failures — hint is cosmetic only
  }
}

export function useNoseHoldHint() {
  const [showNoseHint, setShowNoseHint] = useState(() => !isNoseHoldHintDismissed())

  const dismissNoseHint = useCallback(() => {
    dismissNoseHoldHint()
    setShowNoseHint(false)
  }, [])

  return { showNoseHint, dismissNoseHint }
}
