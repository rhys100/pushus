import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '@/lib/cn'
import { completedLapColorForCount, LAP_COLORS, lapIndexForCount } from '@/lib/loggerLaps'
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

/** Hold the ring centre this long to trigger the long-press action (nose mode). */
const CENTER_HOLD_MS = 1500
const HOLD_RADIUS = 70
const HOLD_CIRCUMFERENCE = 2 * Math.PI * HOLD_RADIUS
/** Comet head/tail styling for the current-lap snake. */
const HEAD_GLOW_DEGREES = 54
const HEAD_HIGHLIGHT_DEGREES = 14
/** Teardrop comet: stroke tapers from a fat head down to a thin wisp at the tail. */
const TRAIL_HEAD_WIDTH = RING_STROKE - 1
const TRAIL_TAIL_WIDTH = 4

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
  /** Fired when the ring centre is held for CENTER_HOLD_MS (opens nose mode). */
  onLongPressCenter?: () => void
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
      onLongPressCenter,
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
    const centerHoldTimerRef = useRef(0)
    const centerHoldFiredRef = useRef(false)
    const [centerHolding, setCenterHolding] = useState(false)

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

        if (centerHoldTimerRef.current) {
          window.clearTimeout(centerHoldTimerRef.current)
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

    // Lap fill: each lap (10 reps) is one revolution. The current lap draws as
    // a glowing comet "snake" — bright rounded head at the handle, tapering and
    // fading back along the arc to the lap start — that closes into a full ring
    // at 10. The previously completed lap sits underneath as a solid base ring.
    // Colours ramp gentle → hot across the 10 laps (see src/lib/loggerLaps.ts).
    const lapIndex = lapIndexForCount(displayCount)
    const currentLapColor = LAP_COLORS[Math.max(0, Math.min(LAP_COLORS.length - 1, lapIndex))]
    const baseLapColor = completedLapColorForCount(displayCount)
    const isFullLap = headAngle >= CIRCULAR_COUNTER.degreesPerRevolution - 0.001

    // Comet trail: many short segments from the head backwards. Both the stroke
    // width and the opacity taper toward the lap start, giving a teardrop comet
    // — a fat bright head that thins into a faint wisp — rather than a flat ring.
    const trailSegments: { d: string; opacity: number; width: number; head: boolean }[] = []

    if (headAngle > 0 && !isFullLap) {
      const segments = Math.max(6, Math.min(72, Math.ceil(headAngle / 3.5)))
      const span = headAngle / segments

      for (let i = 0; i < segments; i += 1) {
        const end = headAngle - span * i
        const start = Math.max(0, end - span - 0.9)

        if (end <= 0.001) {
          break
        }

        const t = segments <= 1 ? 0 : i / (segments - 1)
        trailSegments.push({
          d: describeArc(RING_CENTER, RING_CENTER, RING_RADIUS, start, end),
          opacity: Math.max(0.04, Math.pow(1 - t, 1.3)),
          width: TRAIL_HEAD_WIDTH - (TRAIL_HEAD_WIDTH - TRAIL_TAIL_WIDTH) * t,
          head: i === 0,
        })
      }
    }

    const headGlowPath =
      headAngle > 4 && !isFullLap
        ? describeArc(
            RING_CENTER,
            RING_CENTER,
            RING_RADIUS,
            Math.max(0, headAngle - HEAD_GLOW_DEGREES),
            headAngle,
          )
        : null
    const headHighlightPath =
      headAngle > 3 && !isFullLap
        ? describeArc(
            RING_CENTER,
            RING_CENTER,
            RING_RADIUS,
            Math.max(0, headAngle - HEAD_HIGHLIGHT_DEGREES),
            headAngle,
          )
        : null

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

        // A press that started on the centre can slide into a ring drag; cancel
        // the pending 1.5s hold so nose mode never opens mid-logging.
        if (centerHoldTimerRef.current) {
          window.clearTimeout(centerHoldTimerRef.current)
          centerHoldTimerRef.current = 0
        }
        setCenterHolding(false)

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

    const clearCenterHold = () => {
      if (centerHoldTimerRef.current) {
        window.clearTimeout(centerHoldTimerRef.current)
        centerHoldTimerRef.current = 0
      }

      setCenterHolding(false)
    }

    const handleCenterPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
      if (disabled) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      centerTapRef.current = { x: event.clientX, y: event.clientY }
      centerHoldFiredRef.current = false

      // Hold the centre for 1.5s to open nose mode; a quick tap still adds one rep.
      if (onLongPressCenter && !unwindingRef.current) {
        setCenterHolding(true)
        centerHoldTimerRef.current = window.setTimeout(() => {
          centerHoldTimerRef.current = 0
          centerHoldFiredRef.current = true
          setCenterHolding(false)

          if (isRepHapticSupported()) {
            navigator.vibrate([30, 40, 30])
          }

          onLongPressCenter()
        }, CENTER_HOLD_MS)
      }
    }

    const handleCenterPointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
      const start = centerTapRef.current

      if (!start || centerHoldTimerRef.current === 0) {
        return
      }

      const dx = event.clientX - start.x
      const dy = event.clientY - start.y

      // Moving off the centre (i.e. starting a drag) cancels the hold.
      if (dx * dx + dy * dy > 196) {
        clearCenterHold()
      }
    }

    const handleCenterPointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
      const holdFired = centerHoldFiredRef.current
      clearCenterHold()

      if (disabled || isDragging || holdFired) {
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
        className={cn('flex flex-col items-center px-4 py-1 touch-none', className)}
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
              'absolute inset-0 h-full w-full touch-none select-none outline-none',
              disabled ? 'cursor-not-allowed opacity-60' : '',
              'focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg',
            )}
            onKeyDown={handleKeyDown}
          >
            <defs>
              <filter id="logger-soft-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
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

            <g pointerEvents="none">
              {baseLapColor ? (
                <circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  r={RING_RADIUS}
                  fill="none"
                  stroke={baseLapColor}
                  strokeWidth={RING_STROKE - 6}
                  opacity={0.85}
                />
              ) : null}

              {isFullLap ? (
                <>
                  <circle
                    cx={RING_CENTER}
                    cy={RING_CENTER}
                    r={RING_RADIUS}
                    fill="none"
                    stroke={currentLapColor}
                    strokeWidth={RING_STROKE + 2}
                    opacity={0.4}
                    filter="url(#logger-soft-blur)"
                  />
                  <circle
                    cx={RING_CENTER}
                    cy={RING_CENTER}
                    r={RING_RADIUS}
                    fill="none"
                    stroke={currentLapColor}
                    strokeWidth={RING_STROKE - 4}
                  />
                </>
              ) : (
                <>
                  {headGlowPath ? (
                    <path
                      d={headGlowPath}
                      fill="none"
                      stroke={currentLapColor}
                      strokeWidth={RING_STROKE + 8}
                      strokeLinecap="round"
                      opacity={0.55}
                      filter="url(#logger-soft-blur)"
                    />
                  ) : null}
                  {trailSegments.map((segment, index) => (
                    <path
                      key={index}
                      d={segment.d}
                      fill="none"
                      stroke={currentLapColor}
                      strokeWidth={segment.width}
                      strokeLinecap="round"
                      opacity={segment.opacity}
                    />
                  ))}
                  {headHighlightPath ? (
                    <path
                      d={headHighlightPath}
                      fill="none"
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth={RING_STROKE - 14}
                      strokeLinecap="round"
                    />
                  ) : null}
                </>
              )}
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
              onPointerMove={handleCenterPointerMove}
              onPointerUp={handleCenterPointerUp}
              onPointerCancel={() => {
                clearCenterHold()
                centerTapRef.current = null
              }}
            />

            {centerHolding ? (
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={HOLD_RADIUS}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={4}
                strokeLinecap="round"
                className="logger-center-hold"
                style={
                  {
                    strokeDasharray: HOLD_CIRCUMFERENCE,
                    '--hold-circ': HOLD_CIRCUMFERENCE,
                  } as CSSProperties
                }
                transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
                pointerEvents="none"
                aria-hidden="true"
              />
            ) : null}

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
                    r={HANDLE_RADIUS + 2}
                    fill={currentLapColor}
                    opacity={0.55}
                    filter="url(#logger-soft-blur)"
                  />
                  <circle
                    cx={handlePoint.x}
                    cy={handlePoint.y}
                    r={HANDLE_RADIUS}
                    fill="#17171d"
                    stroke={currentLapColor}
                    strokeWidth={3}
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
                    fill={currentLapColor}
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
            {centerHolding ? (
              <span className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-accent">
                Keep holding…
              </span>
            ) : null}
          </div>
        </div>
      </div>
    )
  },
)
