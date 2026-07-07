import { useEffect, useState } from 'react'

/**
 * Keep a component mounted while its exit animation plays. `mounted` is what
 * you render on; `closing` is true during the exit window — swap your enter
 * class for the exit class while it's set.
 */
export function usePresence(open: boolean, exitMs = 200): {
  mounted: boolean
  closing: boolean
} {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }

    if (!mounted) {
      return
    }

    const timer = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(timer)
  }, [open, mounted, exitMs])

  return { mounted, closing: mounted && !open }
}
