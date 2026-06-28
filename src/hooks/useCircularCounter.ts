import { useCallback, useMemo, useState } from 'react'
import { angleToTotalCount } from '@/lib/circularCounter'
import { pulseRepHapticDelta } from '@/lib/repHaptic'

export type UseCircularCounterOptions = {
  initialAngle?: number
  onRepTick?: (count: number) => void
  /** Haptic tick per rep while increasing count (mobile drag). Default true. */
  enableHaptic?: boolean
}

export function useCircularCounter(options: UseCircularCounterOptions = {}) {
  const { initialAngle = 0, onRepTick, enableHaptic = true } = options
  const [angle, setAngleState] = useState(initialAngle)

  const count = useMemo(() => angleToTotalCount(angle), [angle])

  const setAngle = useCallback(
    (nextAngle: number) => {
      setAngleState((prev) => {
        const prevCount = angleToTotalCount(prev)
        const nextCount = angleToTotalCount(nextAngle)

        if (nextCount > prevCount) {
          if (enableHaptic) {
            pulseRepHapticDelta(prevCount, nextCount)
          }

          if (onRepTick) {
            for (let rep = prevCount + 1; rep <= nextCount; rep++) {
              onRepTick(rep)
            }
          }
        }

        return Math.max(0, nextAngle)
      })
    },
    [enableHaptic, onRepTick],
  )

  const reset = useCallback(() => {
    setAngleState(0)
  }, [])

  return {
    angle,
    count,
    setAngle,
    reset,
    canBank: count > 0,
  }
}
