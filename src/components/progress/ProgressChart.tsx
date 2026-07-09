import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/cn'
import { easeOutCubic, prefersReducedMotion } from '@/lib/motion'

export type ProgressChartSeries = {
  name: string
  color: string
  values: number[]
}

export type ProgressChartProps = {
  series: ProgressChartSeries[]
  labels: string[]
  ariaLabel: string
  className?: string
}

const WIDTH = 320
const HEIGHT = 150
const PAD_LEFT = 34
const PAD_RIGHT = 10
const PAD_TOP = 10
const PAD_BOTTOM = 22
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM

/** Draw duration for the leader dot's full run along the line. */
const DRAW_MS = 1100
/** Extra head start each subsequent series waits before its dot sets off. */
const SERIES_STAGGER_MS = 240
/** Time constant for the yarn trailing the dot — bigger = lazier yarn. */
const YARN_TAU_MS = 90

/** Round the axis max up to a friendly step so gridlines land on round numbers. */
function niceMax(rawMax: number): number {
  if (rawMax <= 10) return Math.max(4, Math.ceil(rawMax / 2) * 2)
  if (rawMax <= 50) return Math.ceil(rawMax / 10) * 10
  if (rawMax <= 200) return Math.ceil(rawMax / 25) * 25
  return Math.ceil(rawMax / 100) * 100
}

type Point = { x: number; y: number }

type SeriesGeometry = {
  points: Point[]
  /** Cumulative arc length at each point (cum[0] = 0). */
  cum: number[]
  total: number
  path: string
}

function seriesGeometry(points: Point[]): SeriesGeometry {
  const cum: number[] = [0]

  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    cum.push(cum[i - 1] + Math.hypot(dx, dy))
  }

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  return { points, cum, total: cum[cum.length - 1], path }
}

/** Position along the polyline at arc length `len`. */
function pointAtLength(geometry: SeriesGeometry, len: number): Point {
  const { points, cum } = geometry

  let i = 1
  while (i < cum.length && cum[i] < len) {
    i += 1
  }

  if (i >= cum.length) {
    return points[points.length - 1]
  }

  const segLen = cum[i] - cum[i - 1] || 1
  const t = (len - cum[i - 1]) / segLen

  return {
    x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
    y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
  }
}

/**
 * One data line drawn like yarn chasing a dot: a leader dot races along the
 * data path (fast start, easing into the last point) while the stroke trails
 * behind it on a lag, popping each data dot as it passes. The final dot lands
 * with a ping ring. Renders statically when `animate` is false.
 */
function SeriesLine({
  geometry,
  color,
  delayMs,
  animate,
}: {
  geometry: SeriesGeometry
  color: string
  delayMs: number
  animate: boolean
}) {
  const pathRef = useRef<SVGPathElement>(null)
  const leaderRef = useRef<SVGCircleElement>(null)
  const dotsRef = useRef<(SVGCircleElement | null)[]>([])
  const pingRef = useRef<SVGCircleElement>(null)

  const { points, cum, total } = geometry
  const lastIndex = points.length - 1
  const running = animate && points.length > 1 && total > 0

  useEffect(() => {
    if (!running) {
      return
    }

    const path = pathRef.current
    const leader = leaderRef.current
    if (!path || !leader) {
      return
    }

    let yarnLen = 0
    let revealed = 0
    let start: number | null = null
    let lastNow: number | null = null
    let frame = 0

    const revealDot = (index: number) => {
      const dot = dotsRef.current[index]
      if (dot) {
        dot.classList.remove('chart-dot-hidden')
        dot.classList.add('chart-dot-pop')
      }
    }

    const step = (now: number) => {
      if (start === null) {
        start = now
        lastNow = now
      }

      const elapsed = now - start - delayMs
      const dt = now - (lastNow ?? now)
      lastNow = now

      if (elapsed < 0) {
        frame = requestAnimationFrame(step)
        return
      }

      leader.style.opacity = '1'

      const t = Math.min(1, elapsed / DRAW_MS)
      const dotLen = total * easeOutCubic(t)

      // The yarn chases the dot: exponential follow, so it stretches on the
      // dot's fast start and snaps closed as the dot slows into the end.
      yarnLen += (dotLen - yarnLen) * (1 - Math.exp(-dt / YARN_TAU_MS))

      const finished = t >= 1 && dotLen - yarnLen < 0.5
      if (finished) {
        yarnLen = total
      }

      const dotPos = pointAtLength(geometry, dotLen)
      leader.setAttribute('cx', dotPos.x.toFixed(2))
      leader.setAttribute('cy', dotPos.y.toFixed(2))
      path.style.strokeDashoffset = String(Math.max(0, total - yarnLen))

      while (revealed < points.length && cum[revealed] <= yarnLen + 0.5) {
        revealDot(revealed)
        revealed += 1
      }

      if (finished) {
        while (revealed < points.length) {
          revealDot(revealed)
          revealed += 1
        }
        leader.style.opacity = '0'
        pingRef.current?.classList.add('chart-ping')
        return
      }

      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [geometry, cum, points.length, total, delayMs, running])

  return (
    <g>
      <path
        ref={pathRef}
        d={geometry.path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          running
            ? { strokeDasharray: total, strokeDashoffset: total }
            : undefined
        }
      />

      {points.map((point, index) => (
        <circle
          key={index}
          ref={(el) => {
            dotsRef.current[index] = el
          }}
          cx={point.x}
          cy={point.y}
          r={index === lastIndex ? 3.5 : 2}
          fill={color}
          className={cn('chart-dot', running && 'chart-dot-hidden')}
        />
      ))}

      {running ? (
        <>
          {/* Ping ring fired when the yarn lands on the final dot */}
          <circle
            ref={pingRef}
            cx={points[lastIndex].x}
            cy={points[lastIndex].y}
            r={4}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            opacity={0}
          />
          {/* Leader dot with a soft halo — the yarn chases this */}
          <circle
            ref={leaderRef}
            cx={points[0].x}
            cy={points[0].y}
            r={3.5}
            fill={color}
            stroke={color}
            strokeOpacity={0.3}
            strokeWidth={5}
            style={{ opacity: 0 }}
          />
        </>
      ) : null}
    </g>
  )
}

/**
 * Dependency-free SVG line chart for rep progression. One line per series
 * (e.g. Left/Right for sided activities), dots on every bucket, sparse x
 * labels, zero-baseline y axis so growth reads honestly. Draws itself in on
 * load — grid fades up, then each line is chased in by its leader dot.
 */
export function ProgressChart({ series, labels, ariaLabel, className }: ProgressChartProps) {
  const pointCount = labels.length
  const rawMax = Math.max(1, ...series.flatMap((s) => s.values))
  const maxValue = niceMax(rawMax)
  const midValue = Math.round(maxValue / 2)

  const xFor = (index: number) =>
    pointCount <= 1
      ? PAD_LEFT + PLOT_WIDTH / 2
      : PAD_LEFT + (PLOT_WIDTH * index) / (pointCount - 1)
  const yFor = (value: number) => PAD_TOP + PLOT_HEIGHT * (1 - value / maxValue)

  // At most ~5 x labels so short widths stay readable.
  const labelStep = Math.max(1, Math.ceil(pointCount / 5))

  // Re-key on data change so the draw replays when the user switches
  // activity, range or metric — not on unrelated re-renders.
  const signature = useMemo(
    () => JSON.stringify({ labels, values: series.map((s) => s.values) }),
    [labels, series],
  )

  const geometries = useMemo(
    () =>
      series.map((line) =>
        seriesGeometry(
          line.values.map((value, index) => ({ x: xFor(index), y: yFor(value) })),
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, maxValue, pointCount],
  )

  const animate = !prefersReducedMotion()

  return (
    <svg
      key={signature}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
      className={cn('h-auto w-full', className)}
    >
      {[0, midValue, maxValue].map((gridValue) => (
        <g key={gridValue} className={animate ? 'chart-fade-in' : undefined}>
          <line
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={yFor(gridValue)}
            y2={yFor(gridValue)}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray={gridValue === 0 ? undefined : '3 4'}
          />
          <text
            x={PAD_LEFT - 6}
            y={yFor(gridValue) + 3}
            textAnchor="end"
            fontSize={9}
            fill="var(--color-text-muted)"
            fontFamily="var(--font-mono)"
          >
            {gridValue}
          </text>
        </g>
      ))}

      {labels.map((label, index) =>
        index % labelStep === 0 || index === pointCount - 1 ? (
          <text
            key={`${label}-${index}`}
            x={xFor(index)}
            y={HEIGHT - 8}
            textAnchor="middle"
            fontSize={9}
            fill="var(--color-text-muted)"
            className={animate ? 'chart-fade-in' : undefined}
            style={animate ? { animationDelay: `${index * 30}ms` } : undefined}
          >
            {label}
          </text>
        ) : null,
      )}

      {series.map((line, seriesIndex) => (
        <SeriesLine
          key={line.name}
          geometry={geometries[seriesIndex]}
          color={line.color}
          delayMs={200 + seriesIndex * SERIES_STAGGER_MS}
          animate={animate}
        />
      ))}
    </svg>
  )
}
