import { useCallback, useState } from 'react'

const STORAGE_KEY = 'pushus.ring-hint-v1'

export function isLoggerDragHintDismissed(): boolean {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissLoggerDragHint(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Ignore storage failures — hint is cosmetic only
  }
}

export function useLoggerDragHint() {
  const [showHint, setShowHint] = useState(() => !isLoggerDragHintDismissed())

  const dismissHint = useCallback(() => {
    dismissLoggerDragHint()
    setShowHint(false)
  }, [])

  return { showHint, dismissHint }
}
