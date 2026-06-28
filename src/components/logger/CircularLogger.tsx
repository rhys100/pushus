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
} from '@/lib/circularCounter'
import { isNearHandle } from '@/lib/loggerHitTest'
import { useCircularCounter } from '@/hooks/useCircularCounter'
import { primeRepFeedback, pulseRepHapticDelta } from '@/lib/repHaptic'

const RING_SIZE = 280
const RING_CENTER = RING_SIZE / 2
const RING_RADIUS = 112
const RING_STROKE = 14
const HANDLE_RADIUS = 13
const HANDLE_HIT_RADIUS = 22
const REP_TICK_ANGLES = Array.from(
  { length: CIRCULAR_COUNTER.repsPerRevolution - 1 },
  (_, index) => (index + 1) * CIRCULAR_COUNTER.degreesPerRep,
)

export type CircularLoggerHandle = {
  getCount: () => number
  reset: () => void
}

export type CircularLoggerProps = {
  onRepTick?: (count: number) => void
  onCountChange?: (count: number) => void
  onCanBankChange?: (canBank: boolean) => void
  onBank?: () => void
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

function getRingVisualState(totalAngle: number) {
  const count = angleToTotalCount(totalAngle)
  const displayAngle = totalAngle % CIRCULAR_COUNTER.degreesPerRevolution
  const completedLap = count > 0 && count % CIRCULAR_COUNTER.repsPerRevolution === 0
  const handleAngle = completedLap ? 0 : displayAngle || 0
  const handlePoint = polarToCartesian(RING_CENTER, RING_CENTER, RING_RADIUS, handleAngle)
  const progressEnd = completedLap ? 360 : displayAngle
  const arcPath =
    !completedLap && progressEnd > 0
      ? describeArc(RING_CENTER, RING_CENTER, RING_RADIUS, 0, progressEnd)
      : ''

  return {
    completedLap,
    handlePoint,
    arcPath,
  }
}

function getPointerAngle(clientX: number, clientY: number, rect: DOMRect): number {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const radians = Math.atan2(clientY - centerY, clientX - centerX)

  return (radians * 180) / Math.PI
}

function normalizeAngleDelta(delta: number): number {
  if (delta > 180) {
    return delta - 360
  }

  if (delta < -180) {
    return delta + 360
  }

  return delta
}

export const CircularLogger = forwardRef<CircularLoggerHandle, CircularLoggerProps>(
  function CircularLogger(
    {
      onRepTick,
      onCountChange,
      onCanBankChange,
      onBank,
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
    const ringContainerRef = useRef<HTMLDivElement>(null)
    const handleRef = useRef<SVGCircleElement>(null)
    const handleHitRef = useRef<SVGCircleElement>(null)
    const arcRef = useRef<SVGPathElement>(null)
    const completedArcRef = useRef<SVGCircleElement>(null)
    const dragStateRef = useRef<{ lastPointerAngle: number; cumulativeAngle: number } | null>(
      null,
    )
    const [countPulsing, setCountPulsing] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const previousCountRef = useRef(count)

    angleRef.current = angle
    disabledRef.current = disabled

    useImperativeHandle(
      ref,
      () => ({
        getCount: () => countRef.current,
        reset,
      }),
      [reset],
    )

    const updateRingVisuals = useCallback((totalAngle: number) => {
      const { completedLap, handlePoint, arcPath } = getRingVisualState(totalAngle)

      handleRef.current?.setAttribute('cx', String(handlePoint.x))
      handleRef.current?.setAttribute('cy', String(handlePoint.y))
      handleHitRef.current?.setAttribute('cx', String(handlePoint.x))
      handleHitRef.current?.setAttribute('cy', String(handlePoint.y))

      if (completedLap) {
        completedArcRef.current?.setAttribute('opacity', '1')
        arcRef.current?.setAttribute('d', '')
      } else {
        completedArcRef.current?.setAttribute('opacity', '0')
        arcRef.current?.setAttribute('d', arcPath)
      }
    }, [])

    useEffect(() => {
      if (!isDragging) {
        updateRingVisuals(angle)
      }
    }, [angle, isDragging, updateRingVisuals])

    useEffect(() => {
      countRef.current = count
      lastHapticCountRef.current = count

      if (count !== previousCountRef.current) {
        onCountChange?.(count)
      }

      if (count > previousCountRef.current) {
        setCountPulsing(true)
      }

      previousCountRef.current = count
    }, [count, onCountChange])

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

    const displayAngle = angle % CIRCULAR_COUNTER.degreesPerRevolution
    const completedLap = count > 0 && count % CIRCULAR_COUNTER.repsPerRevolution === 0
    const handleAngle = completedLap ? 0 : displayAngle || 0
    const handlePoint = polarToCartesian(RING_CENTER, RING_CENTER, RING_RADIUS, handleAngle)
    const showZeroHint = showDragHint && count === 0 && !disabled && !isDragging
    const showHandle = !disabled
    const progressEnd = completedLap ? 360 : displayAngle
    const arcPath =
      !completedLap && progressEnd > 0
        ? describeArc(RING_CENTER, RING_CENTER, RING_RADIUS, 0, progressEnd)
        : ''

    const maybePulseHaptic = useCallback((nextCount: number) => {
      if (nextCount > lastHapticCountRef.current) {
        pulseRepHapticDelta(lastHapticCountRef.current, nextCount)
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

        const pointerAngle = getPointerAngle(clientX, clientY, rect)
        const delta = normalizeAngleDelta(pointerAngle - dragState.lastPointerAngle)

        dragState.lastPointerAngle = pointerAngle
        dragState.cumulativeAngle = Math.max(0, dragState.cumulativeAngle + delta)

        updateRingVisuals(dragState.cumulativeAngle)

        const nextCount = angleToTotalCount(dragState.cumulativeAngle)

        if (haptic) {
          maybePulseHaptic(nextCount)
        }

        if (nextCount !== countRef.current) {
          syncAngleState(dragState.cumulativeAngle)
        } else {
          angleRef.current = dragState.cumulativeAngle
        }

        if (Math.abs(delta) > 0.5) {
          onHintDismiss?.()
        }
      },
      [maybePulseHaptic, onHintDismiss, syncAngleState, updateRingVisuals],
    )

    const endDragSession = useCallback(() => {
      const dragState = dragStateRef.current

      if (dragState) {
        syncAngleState(dragState.cumulativeAngle)
      }

      dragStateRef.current = null
      setIsDragging(false)
    }, [syncAngleState])

    const beginDragAt = useCallback(
      (clientX: number, clientY: number) => {
        if (disabledRef.current) {
          return
        }

        const rect = ringRef.current?.getBoundingClientRect()

        if (!rect) {
          return
        }

        const { handlePoint: currentHandlePoint } = getRingVisualState(angleRef.current)

        if (!isNearHandle(clientX, clientY, rect, currentHandlePoint, HANDLE_HIT_RADIUS)) {
          return
        }

        setIsDragging(true)
        dragStateRef.current = {
          lastPointerAngle: getPointerAngle(clientX, clientY, rect),
          cumulativeAngle: angleRef.current,
        }
      },
      [],
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
      const hitTarget = handleHitRef.current

      if (!hitTarget || disabled || !showHandle) {
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

      hitTarget.addEventListener('touchstart', onTouchStart, { passive: true })

      return () => {
        hitTarget.removeEventListener('touchstart', onTouchStart)
      }
    }, [beginDragAt, disabled, showHandle])

    const handleHitPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
      if (disabled || event.pointerType === 'touch') {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      primeRepFeedback()
      beginDragAt(event.clientX, event.clientY)
    }

    const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
      if (disabled) {
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
        onHintDismiss?.()

        const currentCount = countRef.current
        const nextCount = currentCount + 1
        const nextAngle = countToAngle(nextCount)

        if (angleToTotalCount(nextAngle) > currentCount) {
          pulseRepHapticDelta(currentCount, nextCount)
          setAngle(nextAngle)
          countRef.current = nextCount
          lastHapticCountRef.current = nextCount
        }

        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        event.preventDefault()

        const currentCount = countRef.current

        if (currentCount > 0) {
          setAngle(countToAngle(currentCount - 1))
          countRef.current = currentCount - 1
        }
      }
    }

    return (
      <div
        ref={ringContainerRef}
        className={cn('flex justify-center px-4 py-1', className)}
        style={{ touchAction: isDragging ? 'none' : undefined }}
      >
        <div className="relative h-[min(72vw,280px)] w-[min(72vw,280px)]">
          <svg
            ref={ringRef}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Push-up counter"
            aria-valuemin={0}
            aria-valuemax={999}
            aria-valuenow={count}
            aria-valuetext={`${count} push-ups`}
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
                  stdDeviation="6"
                  floodColor="var(--color-accent)"
                  floodOpacity="0.35"
                />
              </filter>
            </defs>

            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={RING_STROKE}
              opacity={0.65}
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

            <circle
              ref={completedArcRef}
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={RING_STROKE}
              opacity={completedLap ? 1 : 0}
              pointerEvents="none"
              filter={isDragging ? undefined : 'url(#logger-glow)'}
            />

            <path
              ref={arcRef}
              d={arcPath}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={RING_STROKE}
              strokeLinecap="butt"
              pointerEvents="none"
              filter={isDragging ? undefined : 'url(#logger-glow)'}
            />

            {showHandle ? (
              <>
                <circle
                  ref={handleHitRef}
                  data-testid="logger-handle-hit"
                  cx={handlePoint.x}
                  cy={handlePoint.y}
                  r={HANDLE_HIT_RADIUS}
                  fill="transparent"
                  stroke="none"
                  className={disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
                  onPointerDown={handleHitPointerDown}
                />
                <circle
                  ref={handleRef}
                  data-testid="logger-handle-visible"
                  cx={handlePoint.x}
                  cy={handlePoint.y}
                  r={HANDLE_RADIUS}
                  fill="var(--color-accent)"
                  stroke="var(--color-bg)"
                  strokeWidth={3}
                  pointerEvents="none"
                  className={cn(
                    showZeroHint && 'logger-handle-pulse',
                    !showZeroHint && count === 0 && !isDragging && 'logger-handle-idle',
                    isDragging && countPulsing && 'logger-handle-tick',
                  )}
                  style={{
                    willChange: isDragging ? 'transform' : undefined,
                  }}
                />
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
            <span
              className={cn(
                'font-mono font-bold tabular-nums leading-none text-text-primary',
                countPulsing && 'logger-count-pulse',
              )}
              style={{ fontSize: 'var(--text-hero)' }}
            >
              {count}
            </span>
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
