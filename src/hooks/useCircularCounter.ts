import { useCallback, useMemo, useState } from 'react'
import { angleToTotalCount } from '@/lib/circularCounter'

export type UseCircularCounterOptions = {
  initialAngle?: number
  onRepTick?: (count: number) => void
}

export function useCircularCounter(options: UseCircularCounterOptions = {}) {
  const { initialAngle = 0, onRepTick } = options
  const [angle, setAngleState] = useState(initialAngle)

  const count = useMemo(() => angleToTotalCount(angle), [angle])

  const setAngle = useCallback(
    (nextAngle: number) => {
      setAngleState((prev) => {
        const prevCount = angleToTotalCount(prev)
        const nextCount = angleToTotalCount(nextAngle)

        if (onRepTick && nextCount > prevCount) {
          onRepTick(nextCount)
        }

        return Math.max(0, nextAngle)
      })
    },
    [onRepTick],
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
