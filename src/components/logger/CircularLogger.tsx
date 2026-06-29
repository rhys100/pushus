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
  countToProgressArcEnd,
  normalizeAngleDelta,
  rawAngleFromPointerDown,
  ringAngleToRawAngle,
  snapAngleToRep,
} from '@/lib/circularCounter'
import { isPointOnRingTrack, pointerToRingAngle } from '@/lib/loggerHitTest'
import { useCircularCounter } from '@/hooks/useCircularCounter'
import { primeRepFeedback, pulseRepHapticDelta } from '@/lib/repHaptic'

const RING_SIZE = 280
const RING_CENTER = RING_SIZE / 2
const RING_RADIUS = 112
const RING_STROKE = 14
const RING_HIT_STROKE = 28
const HANDLE_RADIUS = 13
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
    const ringTrackHitRef = useRef<SVGCircleElement>(null)
    const ringContainerRef = useRef<HTMLDivElement>(null)
    const dragStateRef = useRef<{ lastPointerAngle: number; rawAngle: number } | null>(
      null,
    )
    const [countPulsing, setCountPulsing] = useState(false)
    const [handleTickKey, setHandleTickKey] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const previousCountRef = useRef(count)

    angleRef.current = angle
    disabledRef.current = disabled

    const resetLogger = useCallback(() => {
      setHandleTickKey(0)
      reset()
    }, [reset])

    useImperativeHandle(
      ref,
      () => ({
        getCount: () => countRef.current,
        reset: resetLogger,
      }),
      [resetLogger],
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

    const displayAngle = angle % CIRCULAR_COUNTER.degreesPerRevolution
    const displayCount = isDragging ? countRef.current : count
    const completedLap =
      displayCount > 0 && displayCount % CIRCULAR_COUNTER.repsPerRevolution === 0
    const handleAngle = completedLap ? 0 : displayAngle || 0
    const handlePoint = polarToCartesian(RING_CENTER, RING_CENTER, RING_RADIUS, handleAngle)
    const showZeroHint = showDragHint && displayCount === 0 && !disabled && !isDragging
    const showHandle = !disabled
    const progressEnd = countToProgressArcEnd(displayCount)
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
        if (disabledRef.current) {
          return
        }

        const rect = ringRef.current?.getBoundingClientRect()

        if (!rect) {
          return
        }

        if (!isPointOnRingTrack(clientX, clientY, rect, RING_RADIUS, RING_HIT_STROKE)) {
          return
        }

        const ringAngle = pointerToRingAngle(clientX, clientY, rect)
        const startRaw =
          countRef.current === 0
            ? rawAngleFromPointerDown(ringAngle)
            : ringAngleToRawAngle(ringAngle, angleRef.current)
        const startCount = angleToTotalCount(startRaw)

        primeRepFeedback()
        syncAngleState(startRaw)
        notifyCountChange(startCount)
        lastHapticCountRef.current = startCount

        if (startCount > 0) {
          setCountPulsing(true)
        }

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
      const hitTarget = ringTrackHitRef.current

      if (!hitTarget || disabled) {
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
    }, [beginDragAt, disabled])

    const handleRingPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
      if (disabled || event.pointerType === 'touch') {
        return
      }

      event.preventDefault()
      event.stopPropagation()
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
              d={arcPath}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={RING_STROKE}
              strokeLinecap="butt"
              pointerEvents="none"
              filter={isDragging ? undefined : 'url(#logger-glow)'}
            />

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

            {showHandle ? (
              <circle
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
                  handleTickKey > 0 && 'logger-handle-tick',
                )}
              />
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
              {displayCount}
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
