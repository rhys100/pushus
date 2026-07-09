import { useEffect, useRef, useState } from 'react'
import { easeOutCubic, prefersReducedMotion } from '@/lib/motion'

/**
 * Animate a displayed integer toward `target`: counts up (or down) with an
 * ease-out ramp whenever the value changes. First render shows the value
 * counting in from 0 so stats feel like they load with weight.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? target : 0))
  const displayRef = useRef(display)
  displayRef.current = display

  useEffect(() => {
    const from = displayRef.current

    if (from === target) {
      return
    }

    if (prefersReducedMotion()) {
      setDisplay(target)
      return
    }

    let frame = 0
    const start = performance.now()

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const value = Math.round(from + (target - from) * easeOutCubic(t))
      setDisplay(value)

      if (t < 1) {
        frame = requestAnimationFrame(step)
      }
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return display
}
