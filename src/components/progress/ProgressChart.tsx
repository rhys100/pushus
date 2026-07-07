import { cn } from '@/lib/cn'

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

/** Round the axis max up to a friendly step so gridlines land on round numbers. */
function niceMax(rawMax: number): number {
  if (rawMax <= 10) return Math.max(4, Math.ceil(rawMax / 2) * 2)
  if (rawMax <= 50) return Math.ceil(rawMax / 10) * 10
  if (rawMax <= 200) return Math.ceil(rawMax / 25) * 25
  return Math.ceil(rawMax / 100) * 100
}

/**
 * Dependency-free SVG line chart for rep progression. One line per series
 * (e.g. Left/Right for sided activities), dots on every bucket, sparse x
 * labels, zero-baseline y axis so growth reads honestly.
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

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
      className={cn('h-auto w-full', className)}
    >
      {[0, midValue, maxValue].map((gridValue) => (
        <g key={gridValue}>
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
          >
            {label}
          </text>
        ) : null,
      )}

      {series.map((line) => {
        const path = line.values
          .map((value, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(value)}`)
          .join(' ')

        return (
          <g key={line.name}>
            <path
              d={path}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {line.values.map((value, index) => (
              <circle
                key={index}
                cx={xFor(index)}
                cy={yFor(value)}
                r={index === line.values.length - 1 ? 3.5 : 2}
                fill={line.color}
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}
