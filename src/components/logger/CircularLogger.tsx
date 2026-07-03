import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '@/lib/cn'
import {
  angleToTotalCount,
  CIRCULAR_COUNTER,
  countToAngle,
  normalizeAngleDelta,
  snapAngleToRep,
} from '@/lib/circularCounter'
import {
  canStartRingDrag,
  LOGGER_HANDLE_GRAB_RADIUS,
  LOGGER_RING_SIZE,
  pointerToRingAngle,
} from '@/lib/loggerHitTest'
import { useCircularCounter } from '@/hooks/useCircularCounter'
import {
  playClickClack,
  playDoosh,
  playRepTick,
  playUnwindTick,
} from '@/lib/dinkSound'
import {
  isRepHapticSupported,
  primeRepFeedback,
  pulseRepHapticDelta,
  repHapticPatternForCount,
} from '@/lib/repHaptic'

const RING_SIZE = LOGGER_RING_SIZE
const RING_CENTER = RING_SIZE / 2
const RING_RADIUS = 130
const RING_STROKE = 30
const RING_HIT_STROKE = 44
const HANDLE_RADIUS = 24
const HANDLE_GRAB_RADIUS = LOGGER_HANDLE_GRAB_RADIUS
const CENTER_HIT_RADIUS = RING_RADIUS - RING_STROKE - 8
const RING_CONTAINER_SIZE = 'min(72vw,336px)'
const REP_TICK_ANGLES = Array.from(
  { length: CIRCULAR_COUNTER.repsPerRevolution - 1 },
  (_, index) => (index + 1) * CIRCULAR_COUNTER.degreesPerRep,
)

export type CircularLoggerHandle = {
  getCount: () => number
  reset: () => void
  /** Animate the counter back to 0 with an S-curve spin-down and per-rep trill. */
  unwind: () => void
}

/** Trail behind the handle fades out over this arc span — 1/5 of the circle. */
const TRAIL_DEGREES = 72
const TRAIL_SEGMENTS = 18

/** Mecha lock-in after the unwind lands on zero: expand → settle → DOOOSH. */
type LockInPhase = 'expand' | 'settle' | 'doosh' | null
const LOCK_IN_SETTLE_AT_MS = 170
const LOCK_IN_DOOSH_AT_MS = 340
const LOCK_IN_DONE_AT_MS = 1350

export type CircularLoggerProps = {
  onRepTick?: (count: number) => void
  onCountChange?: (count: number) => void
  onCanBankChange?: (canBank: boolean) => void
  onBank?: () => void
  onDraggingChange?: (dragging: boolean) => void
  disabled?: boolean
  showDragHint?: boolean
  onHintDismiss?: () => void
  className?: string
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number,
) {
  const radians = ((angleDegrees - 90) * Math.PI) / 180

  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  }
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle)
  const end = polarToCartesian(centerX, centerY, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ')
}

export const CircularLogger = forwardRef<CircularLoggerHandle, CircularLoggerProps>(
  function CircularLogger(
    {
      onRepTick,
      onCountChange,
      onCanBankChange,
      onBank,
      onDraggingChange,
      disabled = false,
      showDragHint = false,
      onHintDismiss,
      className,
    },
    ref,
  ) {
    const { angle, count, setAngle, reset, canBank } = useCircularCounter({
      onRepTick,
      enableHaptic: false,
    })
    const countRef = useRef(count)
    const canBankRef = useRef(canBank)
    const angleRef = useRef(angle)
    const disabledRef = useRef(disabled)
    const lastHapticCountRef = useRef(count)

    const ringRef = useRef<SVGSVGElement>(null)
    const ringTrackHitRef = useRef<SVGCircleElement>(null)
    const handleGrabHitRef = useRef<SVGCircleElement>(null)
    const ringContainerRef = useRef<HTMLDivElement>(null)
    const dragStateRef = useRef<{ lastPointerAngle: number; rawAngle: number } | null>(
      null,
    )
    const [countPulsing, setCountPulsing] = useState(false)
    const [handleTickKey, setHandleTickKey] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [unwindAngle, setUnwindAngle] = useState<number | null>(null)
    const unwindingRef = useRef(false)
    const unwindRafRef = useRef(0)
    const [lockInPhase, setLockInPhase] = useState<LockInPhase>(null)
    const lockInTimeoutsRef = useRef<number[]>([])
    const previousCountRef = useRef(count)
    const centerTapRef = useRef<{ x: number; y: number } | null>(null)

    angleRef.current = angle
    disabledRef.current = disabled

    const clearLockIn = useCallback(() => {
      for (const timeoutId of lockInTimeoutsRef.current) {
        window.clearTimeout(timeoutId)
      }

      lockInTimeoutsRef.current = []
      setLockInPhase(null)
    }, [])

    const resetLogger = useCallback(() => {
      window.cancelAnimationFrame(unwindRafRef.current)
      unwindingRef.current = false
      setUnwindAngle(null)
      setHandleTickKey(0)
      clearLockIn()
      reset()
    }, [clearLockIn, reset])

    const runLockIn = useCallback(() => {
      clearLockIn()
      setLockInPhase('expand')
      playClickClack()

      const schedule = (fn: () => void, delayMs: number) => {
        lockInTimeoutsRef.current.push(window.setTimeout(fn, delayMs))
      }

      schedule(() => setLockInPhase('settle'), LOCK_IN_SETTLE_AT_MS)
      schedule(() => {
        setLockInPhase('doosh')
        playDoosh()

        if (isRepHapticSupported()) {
          navigator.vibrate([90, 30, 140])
        }
      }, LOCK_IN_DOOSH_AT_MS)
      schedule(() => setLockInPhase(null), LOCK_IN_DONE_AT_MS)
    }, [clearLockIn])

    const notifyCountChange = useCallback(
      (nextCount: number) => {
        countRef.current = nextCount

        if (nextCount !== previousCountRef.current) {
          onCountChange?.(nextCount)
          previousCountRef.current = nextCount
        }

        const nextCanBank = nextCount > 0

        if (nextCanBank !== canBankRef.current) {
          canBankRef.current = nextCanBank
          onCanBankChange?.(nextCanBank)
        }
      },
      [onCanBankChange, onCountChange],
    )

    const unwind = useCallback(() => {
      if (unwindingRef.current) {
        return
      }

      const startAngle = angleRef.current
      const startCount = countRef.current

      if (startAngle <= 0 || startCount <= 0) {
        resetLogger()
        return
      }

      unwindingRef.current = true
      const duration = Math.min(2400, 700 + startCount * 55)
      const startTime = performance.now()
      let lastTick = startCount

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration)
        // Ease-in-out cubic — the slow S curve.
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        const angleNow = startAngle * (1 - eased)
        setUnwindAngle(angleNow)

        const remaining = Math.max(
          0,
          Math.ceil(angleNow / CIRCULAR_COUNTER.degreesPerRep - 1e-6),
        )

        if (remaining < lastTick) {
          lastTick = remaining
          playUnwindTick(remaining, startCount)

          if (isRepHapticSupported()) {
            // Notch tick per rep; stronger patterns at 5s, strongest at 10s.
            navigator.vibrate(
              remaining > 0 ? repHapticPatternForCount(remaining) : 18,
            )
          }
        }

        if (t < 1) {
          unwindRafRef.current = window.requestAnimationFrame(step)
        } else {
          unwindingRef.current = false
          setUnwindAngle(null)
          setHandleTickKey(0)
          reset()
          notifyCountChange(0)
          runLockIn()
        }
      }

      unwindRafRef.current = window.requestAnimationFrame(step)
    }, [notifyCountChange, reset, resetLogger, runLockIn])

    useEffect(() => {
      return () => {
        window.cancelAnimationFrame(unwindRafRef.current)

        for (const timeoutId of lockInTimeoutsRef.current) {
          window.clearTimeout(timeoutId)
        }
      }
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        getCount: () => (unwindingRef.current ? 0 : countRef.current),
        reset: resetLogger,
        unwind,
      }),
      [resetLogger, unwind],
    )

    useEffect(() => {
      if (isDragging) {
        return
      }

      countRef.current = count
      lastHapticCountRef.current = count

      if (count !== previousCountRef.current) {
        onCountChange?.(count)
      }

      if (count > previousCountRef.current) {
        setCountPulsing(true)
      }

      previousCountRef.current = count
    }, [count, isDragging, onCountChange])

    useEffect(() => {
      if (!countPulsing) {
        return
      }

      const timer = window.setTimeout(() => {
        setCountPulsing(false)
      }, 220)

      return () => {
        window.clearTimeout(timer)
      }
    }, [countPulsing])

    useEffect(() => {
      if (canBank !== canBankRef.current) {
        canBankRef.current = canBank
        onCanBankChange?.(canBank)
      }
    }, [canBank, onCanBankChange])

    useEffect(() => {
      onDraggingChange?.(isDragging)
    }, [isDragging, onDraggingChange])

    const isUnwinding = unwindAngle !== null
    const baseDisplayCount = isDragging ? countRef.current : count
    const displayCount = isUnwinding
      ? Math.max(0, Math.ceil(unwindAngle / CIRCULAR_COUNTER.degreesPerRep - 1e-6))
      : baseDisplayCount
    // Cumulative angle (can exceed 360° across laps) driving handle + trail.
    const totalAngle = isUnwinding ? unwindAngle : countToAngle(baseDisplayCount)
    const headAngle = (() => {
      if (totalAngle <= 0) {
        return 0
      }

      const withinLap = totalAngle % CIRCULAR_COUNTER.degreesPerRevolution
      return withinLap === 0 ? CIRCULAR_COUNTER.degreesPerRevolution : withinLap
    })()
    const handleAngle = headAngle % CIRCULAR_COUNTER.degreesPerRevolution
    const handlePoint = polarToCartesian(RING_CENTER, RING_CENTER, RING_RADIUS, handleAngle)
    const showZeroHint = showDragHint && displayCount === 0 && !disabled && !isDragging
    const showHandle = !disabled

    // Comet trail: the arc fades out over the trailing 1/5 of the circle.
    // Past the first lap the tail may wrap behind 12 o'clock; within the
    // first lap it clamps at the start.
    const canWrap = totalAngle > CIRCULAR_COUNTER.degreesPerRevolution
    const trailSegments: { d: string; opacity: number; head: boolean }[] = []

    if (headAngle > 0) {
      const segmentSpan = TRAIL_DEGREES / TRAIL_SEGMENTS

      for (let i = 0; i < TRAIL_SEGMENTS; i += 1) {
        const end = headAngle - segmentSpan * i
        let start = end - segmentSpan - 0.6

        if (!canWrap) {
          if (end <= 0) {
            break
          }

          start = Math.max(0, start)
        }

        trailSegments.push({
          d: describeArc(RING_CENTER, RING_CENTER, RING_RADIUS, start, end),
          opacity: 1 - i / TRAIL_SEGMENTS,
          head: i === 0,
        })
      }
    }

    const maybePulseHaptic = useCallback((nextCount: number) => {
      if (nextCount > lastHapticCountRef.current) {
        pulseRepHapticDelta(lastHapticCountRef.current, nextCount)
        playRepTick(nextCount)
        lastHapticCountRef.current = nextCount
      }
    }, [])

    const syncAngleState = useCallback(
      (nextAngle: number) => {
        const clamped = Math.max(0, nextAngle)
        angleRef.current = clamped
        setAngle(clamped)
      },
      [setAngle],
    )

    const incrementRep = useCallback(() => {
      if (disabledRef.current || unwindingRef.current) {
        return
      }

      onHintDismiss?.()

      const currentCount = countRef.current
      const nextCount = currentCount + 1
      const nextAngle = countToAngle(nextCount)

      if (angleToTotalCount(nextAngle) <= currentCount) {
        return
      }

      primeRepFeedback()
      pulseRepHapticDelta(currentCount, nextCount)
      playRepTick(nextCount)
      syncAngleState(nextAngle)
      notifyCountChange(nextCount)
      lastHapticCountRef.current = nextCount
      setCountPulsing(true)
      setHandleTickKey((current) => current + 1)
    }, [notifyCountChange, onHintDismiss, syncAngleState])

    const applyDragAt = useCallback(
      (clientX: number, clientY: number, haptic: boolean) => {
        const dragState = dragStateRef.current

        if (!dragState || disabledRef.current) {
          return
        }

        const rect = ringRef.current?.getBoundingClientRect()

        if (!rect) {
          return
        }

        const ringAngle = pointerToRingAngle(clientX, clientY, rect)
        const delta = normalizeAngleDelta(ringAngle - dragState.lastPointerAngle)

        dragState.lastPointerAngle = ringAngle
        dragState.rawAngle = Math.max(0, dragState.rawAngle + delta)

        const snappedAngle = snapAngleToRep(dragState.rawAngle)
        const nextCount = angleToTotalCount(snappedAngle)
        const currentCount = countRef.current

        syncAngleState(snappedAngle)

        if (nextCount !== currentCount) {
          if (nextCount > currentCount) {
            setCountPulsing(true)
            setHandleTickKey((current) => current + 1)

            if (haptic) {
              maybePulseHaptic(nextCount)
            }
          } else {
            lastHapticCountRef.current = nextCount
          }

          notifyCountChange(nextCount)
        }

        if (Math.abs(delta) > 0.5) {
          onHintDismiss?.()
        }
      },
      [maybePulseHaptic, notifyCountChange, onHintDismiss, syncAngleState],
    )

    const endDragSession = useCallback(() => {
      const dragState = dragStateRef.current

      if (dragState) {
        const finalAngle = snapAngleToRep(dragState.rawAngle)
        syncAngleState(finalAngle)
        notifyCountChange(angleToTotalCount(finalAngle))
      }

      dragStateRef.current = null
      setIsDragging(false)
    }, [notifyCountChange, syncAngleState])

    const beginDragAt = useCallback(
      (clientX: number, clientY: number) => {
        if (disabledRef.current || unwindingRef.current) {
          return
        }

        const rect = ringRef.current?.getBoundingClientRect()

        if (!rect) {
          return
        }

        const currentCount = countRef.current
        const completedLap =
          currentCount > 0 && currentCount % CIRCULAR_COUNTER.repsPerRevolution === 0
        const visualAngle = completedLap
          ? 0
          : countToAngle(currentCount) % CIRCULAR_COUNTER.degreesPerRevolution
        const grabHandlePoint = polarToCartesian(
          RING_CENTER,
          RING_CENTER,
          RING_RADIUS,
          visualAngle,
        )

        if (
          !canStartRingDrag(clientX, clientY, rect, {
            ringRadius: RING_RADIUS,
            ringHitStroke: RING_HIT_STROKE,
            handlePoint: grabHandlePoint,
            handleGrabRadius: HANDLE_GRAB_RADIUS,
            ringSize: RING_SIZE,
          })
        ) {
          return
        }

        const ringAngle = pointerToRingAngle(clientX, clientY, rect)
        const startRaw = angleRef.current
        const startCount = countRef.current

        primeRepFeedback()
        syncAngleState(startRaw)
        notifyCountChange(startCount)
        lastHapticCountRef.current = startCount

        dragStateRef.current = {
          lastPointerAngle: ringAngle,
          rawAngle: startRaw,
        }
        setIsDragging(true)
        onHintDismiss?.()
      },
      [notifyCountChange, onHintDismiss, syncAngleState],
    )

    useLayoutEffect(() => {
      if (!isDragging) {
        return
      }

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch') {
          return
        }

        applyDragAt(event.clientX, event.clientY, true)
      }

      const endPointerSession = () => {
        endDragSession()
      }

      const onTouchMove = (event: TouchEvent) => {
        if (!dragStateRef.current) {
          return
        }

        const touch = event.touches[0]

        if (!touch) {
          return
        }

        event.preventDefault()
        applyDragAt(touch.clientX, touch.clientY, true)
      }

      const onTouchEnd = () => {
        endDragSession()
      }

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', endPointerSession)
      document.addEventListener('pointercancel', endPointerSession)
      document.addEventListener('touchmove', onTouchMove, { passive: false })
      document.addEventListener('touchend', onTouchEnd)
      document.addEventListener('touchcancel', onTouchEnd)

      return () => {
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', endPointerSession)
        document.removeEventListener('pointercancel', endPointerSession)
        document.removeEventListener('touchmove', onTouchMove)
        document.removeEventListener('touchend', onTouchEnd)
        document.removeEventListener('touchcancel', onTouchEnd)
      }
    }, [applyDragAt, endDragSession, isDragging])

    useEffect(() => {
      const hitTargets = [ringTrackHitRef.current, handleGrabHitRef.current].filter(
        (target): target is SVGCircleElement => target != null,
      )

      if (hitTargets.length === 0 || disabled) {
        return
      }

      const onTouchStart = (event: TouchEvent) => {
        primeRepFeedback()

        const touch = event.changedTouches[0]

        if (!touch) {
          return
        }

        event.stopPropagation()
        beginDragAt(touch.clientX, touch.clientY)
      }

      for (const hitTarget of hitTargets) {
        hitTarget.addEventListener('touchstart', onTouchStart, { passive: true })
      }

      return () => {
        for (const hitTarget of hitTargets) {
          hitTarget.removeEventListener('touchstart', onTouchStart)
        }
      }
    }, [beginDragAt, disabled])

    const startDragFromPointer = (clientX: number, clientY: number) => {
      beginDragAt(clientX, clientY)
    }

    const handleRingPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
      if (disabled || event.pointerType === 'touch') {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      startDragFromPointer(event.clientX, event.clientY)
    }

    const handleGrabPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
      if (disabled) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      startDragFromPointer(event.clientX, event.clientY)
    }

    const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
      if (disabled || unwindingRef.current) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()

        if (count > 0) {
          onBank?.()
        }

        return
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        event.preventDefault()
        incrementRep()
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        event.preventDefault()

        const currentCount = countRef.current

        if (currentCount > 0) {
          const nextCount = currentCount - 1
          syncAngleState(countToAngle(nextCount))
          notifyCountChange(nextCount)
          lastHapticCountRef.current = nextCount
        }
      }
    }

    const handleCenterPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
      if (disabled) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      centerTapRef.current = { x: event.clientX, y: event.clientY }
    }

    const handleCenterPointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
      if (disabled || isDragging) {
        centerTapRef.current = null
        return
      }

      const start = centerTapRef.current
      centerTapRef.current = null

      if (!start) {
        return
      }

      const dx = event.clientX - start.x
      const dy = event.clientY - start.y

      if (dx * dx + dy * dy > 100) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      incrementRep()
    }

    return (
      <div
        ref={ringContainerRef}
        className={cn('flex justify-center px-4 py-1', className)}
        style={{ touchAction: isDragging ? 'none' : undefined }}
      >
        <div
          className={cn(
            'relative',
            lockInPhase === 'expand' && 'logger-lockin-expand',
            lockInPhase === 'settle' && 'logger-lockin-settle',
            lockInPhase === 'doosh' && 'logger-lockin-doosh',
          )}
          style={{ height: RING_CONTAINER_SIZE, width: RING_CONTAINER_SIZE }}
        >
          {lockInPhase === 'doosh' ? (
            <div
              aria-hidden="true"
              className="logger-doosh-flash pointer-events-none absolute inset-[-12%] rounded-full"
            />
          ) : null}
          <svg
            ref={ringRef}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Push-up counter"
            aria-valuemin={0}
            aria-valuemax={999}
            aria-valuenow={displayCount}
            aria-valuetext={`${displayCount} push-ups`}
            aria-disabled={disabled || undefined}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className={cn(
              'absolute inset-0 h-full w-full select-none outline-none',
              disabled ? 'cursor-not-allowed opacity-60' : '',
              'focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg',
            )}
            onKeyDown={handleKeyDown}
          >
            <defs>
              <filter id="logger-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="10"
                  floodColor="var(--color-accent)"
                  floodOpacity="0.65"
                />
              </filter>
              <filter id="logger-handle-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="8"
                  floodColor="var(--color-accent)"
                  floodOpacity="0.8"
                />
              </filter>
              <linearGradient id="logger-arc-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-accent-hot)" />
                <stop offset="100%" stopColor="var(--color-accent-deep)" />
              </linearGradient>
            </defs>

            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-surface)"
              strokeWidth={RING_STROKE}
              pointerEvents="none"
            />
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS + RING_STROKE / 2}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={1.5}
              pointerEvents="none"
            />
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS - RING_STROKE / 2}
              fill="none"
              stroke="rgba(0,0,0,0.55)"
              strokeWidth={1.5}
              pointerEvents="none"
            />

            {REP_TICK_ANGLES.map((tickAngle) => {
              const tickPoint = polarToCartesian(
                RING_CENTER,
                RING_CENTER,
                RING_RADIUS,
                tickAngle,
              )

              return (
                <circle
                  key={tickAngle}
                  cx={tickPoint.x}
                  cy={tickPoint.y}
                  r={2}
                  fill="var(--color-border)"
                  opacity={0.45}
                  pointerEvents="none"
                />
              )
            })}

            <g
              pointerEvents="none"
              filter={isDragging || isUnwinding ? undefined : 'url(#logger-glow)'}
            >
              {trailSegments.map((segment, index) => (
                <path
                  key={index}
                  d={segment.d}
                  fill="none"
                  stroke="url(#logger-arc-gradient)"
                  strokeWidth={RING_STROKE - 4}
                  strokeLinecap={segment.head ? 'round' : 'butt'}
                  opacity={segment.opacity}
                />
              ))}
            </g>

            <circle
              ref={ringTrackHitRef}
              data-testid="logger-ring-hit"
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="transparent"
              strokeWidth={RING_HIT_STROKE}
              pointerEvents="stroke"
              className={
                disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
              }
              onPointerDown={handleRingPointerDown}
            />

            <circle
              data-testid="logger-center-hit"
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={CENTER_HIT_RADIUS}
              fill="transparent"
              pointerEvents={disabled ? 'none' : 'all'}
              className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              aria-label="Add one rep"
              onPointerDown={handleCenterPointerDown}
              onPointerUp={handleCenterPointerUp}
              onPointerCancel={() => {
                centerTapRef.current = null
              }}
            />

            {showHandle ? (
              <>
                <circle
                  ref={handleGrabHitRef}
                  data-testid="logger-handle-hit"
                  cx={handlePoint.x}
                  cy={handlePoint.y}
                  r={HANDLE_GRAB_RADIUS}
                  fill="transparent"
                  pointerEvents={disabled ? 'none' : 'all'}
                  className={
                    disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
                  }
                  aria-hidden="true"
                  onPointerDown={handleGrabPointerDown}
                />
                <g
                  data-testid="logger-handle-visible"
                  pointerEvents="none"
                  className={cn(
                    showZeroHint && 'logger-handle-pulse',
                    !showZeroHint && count === 0 && !isDragging && 'logger-handle-idle',
                    handleTickKey > 0 && 'logger-handle-tick',
                  )}
                  style={{ transformOrigin: `${handlePoint.x}px ${handlePoint.y}px` }}
                >
                  <circle
                    cx={handlePoint.x}
                    cy={handlePoint.y}
                    r={HANDLE_RADIUS}
                    fill="#17171d"
                    stroke="var(--color-accent)"
                    strokeWidth={3}
                    filter="url(#logger-handle-glow)"
                  />
                  <circle
                    cx={handlePoint.x}
                    cy={handlePoint.y}
                    r={HANDLE_RADIUS - 8}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={handlePoint.x}
                    cy={handlePoint.y}
                    r={5}
                    fill="var(--color-accent)"
                  />
                </g>
              </>
            ) : null}

            {showZeroHint ? (
              <path
                d={`M ${handlePoint.x - 18} ${handlePoint.y - 28} Q ${handlePoint.x - 8} ${handlePoint.y - 36} ${handlePoint.x + 6} ${handlePoint.y - 30}`}
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.7}
                aria-hidden="true"
                pointerEvents="none"
              />
            ) : null}
          </svg>

          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            aria-hidden="true"
          >
            {lockInPhase === 'doosh' ? (
              <span
                className="logger-banked-stamp font-mono font-bold leading-none text-accent"
                style={{
                  fontSize: 'clamp(2.2rem, 11vw, 3.4rem)',
                  letterSpacing: '0.14em',
                  textShadow:
                    '0 0 18px rgba(255, 107, 53, 0.85), 0 0 56px rgba(255, 77, 0, 0.5)',
                }}
              >
                BANKED
              </span>
            ) : (
              <span
                className={cn(
                  'font-mono font-bold tabular-nums leading-none text-text-primary',
                  countPulsing && 'logger-count-pulse',
                )}
                style={{
                  fontSize: 'var(--text-hero-logger)',
                  textShadow: '0 0 24px rgba(241, 245, 249, 0.35)',
                }}
              >
                {displayCount}
              </span>
            )}
            <span className="mt-2 text-[0.8125rem] font-medium uppercase tracking-[0.18em] text-text-muted">
              reps
            </span>
            {showZeroHint ? (
              <>
                <span className="mt-3 text-[0.75rem] font-medium text-text-muted">
                  Drag the ring
                </span>
                <span className="mt-1 text-[0.6875rem] text-text-muted opacity-75">
                  One lap = 10
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    )
  },
)
