import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
import { useCircularCounter } from '@/hooks/useCircularCounter'
import { primeRepFeedback, pulseRepHapticDelta } from '@/lib/repHaptic'

const RING_SIZE = 280
const RING_CENTER = RING_SIZE / 2
const RING_RADIUS = 112
const RING_STROKE = 14
const HANDLE_RADIUS = 10

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
    const dragStateRef = useRef<{ lastPointerAngle: number; cumulativeAngle: number } | null>(
      null,
    )
    const pendingAngleRef = useRef<number | null>(null)
    const rafRef = useRef<number | null>(null)
    const [pulseKey, setPulseKey] = useState(0)
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

    useEffect(() => {
      countRef.current = count
      lastHapticCountRef.current = count

      if (count !== previousCountRef.current) {
        onCountChange?.(count)
      }

      if (count > previousCountRef.current) {
        setPulseKey((current) => current + 1)
      }

      previousCountRef.current = count
    }, [count, onCountChange])

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

    const flushAngle = useCallback(() => {
      rafRef.current = null

      if (pendingAngleRef.current !== null) {
        setAngle(pendingAngleRef.current)
        pendingAngleRef.current = null
      }
    }, [setAngle])

    const scheduleAngle = useCallback(
      (nextAngle: number) => {
        pendingAngleRef.current = Math.max(0, nextAngle)

        if (rafRef.current === null) {
          rafRef.current = window.requestAnimationFrame(flushAngle)
        }
      },
      [flushAngle],
    )

    useEffect(() => {
      return () => {
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current)
        }
      }
    }, [])

    const maybePulseHaptic = useCallback((nextCount: number) => {
      if (nextCount > lastHapticCountRef.current) {
        pulseRepHapticDelta(lastHapticCountRef.current, nextCount)
        lastHapticCountRef.current = nextCount
      }
    }, [])

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

        if (haptic) {
          maybePulseHaptic(angleToTotalCount(dragState.cumulativeAngle))
        }

        scheduleAngle(dragState.cumulativeAngle)

        if (Math.abs(delta) > 0.5) {
          onHintDismiss?.()
        }
      },
      [maybePulseHaptic, onHintDismiss, scheduleAngle],
    )

    const beginDragAt = useCallback((clientX: number, clientY: number) => {
      if (disabledRef.current) {
        return
      }

      const rect = ringRef.current?.getBoundingClientRect()

      if (!rect) {
        return
      }

      setIsDragging(true)
      dragStateRef.current = {
        lastPointerAngle: getPointerAngle(clientX, clientY, rect),
        cumulativeAngle: angleRef.current,
      }
    }, [])

    const endDragSession = useCallback(() => {
      dragStateRef.current = null
      setIsDragging(false)
    }, [])

    useEffect(() => {
      const ring = ringContainerRef.current

      if (!ring) {
        return
      }

      const onTouchStart = (event: TouchEvent) => {
        primeRepFeedback()

        const touch = event.changedTouches[0]

        if (!touch) {
          return
        }

        beginDragAt(touch.clientX, touch.clientY)
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

      ring.addEventListener('touchstart', onTouchStart, { passive: true })
      ring.addEventListener('touchmove', onTouchMove, { passive: false })
      ring.addEventListener('touchend', onTouchEnd)
      ring.addEventListener('touchcancel', onTouchEnd)

      return () => {
        ring.removeEventListener('touchstart', onTouchStart)
        ring.removeEventListener('touchmove', onTouchMove)
        ring.removeEventListener('touchend', onTouchEnd)
        ring.removeEventListener('touchcancel', onTouchEnd)
      }
    }, [applyDragAt, beginDragAt, endDragSession])

    const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
      if (disabled || event.pointerType === 'touch') {
        return
      }

      event.currentTarget.setPointerCapture(event.pointerId)
      beginDragAt(event.clientX, event.clientY)
    }

    const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.pointerType === 'touch') {
        return
      }

      applyDragAt(event.clientX, event.clientY, true)
    }

    const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.pointerType === 'touch') {
        return
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      endDragSession()
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
        style={{ touchAction: 'none' }}
      >
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
            'h-[min(72vw,280px)] w-[min(72vw,280px)] touch-none select-none outline-none',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing',
            'focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg',
          )}
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
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
          />

          {completedLap ? (
            <circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={RING_STROKE}
              filter={isDragging ? undefined : 'url(#logger-glow)'}
            />
          ) : arcPath ? (
            <path
              d={arcPath}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              filter={isDragging ? undefined : 'url(#logger-glow)'}
            />
          ) : null}

          {showHandle ? (
            <circle
              key={isDragging ? `tick-${pulseKey}` : 'handle'}
              cx={handlePoint.x}
              cy={handlePoint.y}
              r={HANDLE_RADIUS}
              fill="var(--color-accent)"
              stroke="var(--color-bg)"
              strokeWidth={3}
              className={cn(
                'origin-center',
                showZeroHint && 'logger-handle-pulse',
                !showZeroHint && count === 0 && !isDragging && 'logger-handle-idle',
                isDragging && pulseKey > 0 && 'logger-handle-tick',
              )}
              style={{
                transformOrigin: `${handlePoint.x}px ${handlePoint.y}px`,
                willChange: isDragging ? 'transform' : undefined,
              }}
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
            />
          ) : null}

          <text
            x={RING_CENTER}
            y={RING_CENTER - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--color-text)"
            className="font-mono font-bold"
            style={{
              fontSize: 'var(--text-hero)',
              animation:
                pulseKey > 0
                  ? 'logger-count-pulse var(--duration-fast) var(--ease-out)'
                  : undefined,
            }}
            key={pulseKey}
          >
            {count}
          </text>

          <text
            x={RING_CENTER}
            y={RING_CENTER + 36}
            textAnchor="middle"
            fill="var(--color-text-muted)"
            className="text-[0.8125rem] font-medium uppercase tracking-[0.18em]"
          >
            reps
          </text>

          {showZeroHint ? (
            <>
              <text
                x={RING_CENTER}
                y={RING_CENTER + 58}
                textAnchor="middle"
                fill="var(--color-text-muted)"
                className="text-[0.75rem] font-medium"
              >
                Drag the ring
              </text>
              <text
                x={RING_CENTER}
                y={RING_CENTER + 76}
                textAnchor="middle"
                fill="var(--color-text-muted)"
                className="text-[0.6875rem]"
                opacity={0.75}
              >
                One lap = 10
              </text>
            </>
          ) : null}
        </svg>
      </div>
    )
  },
)
