import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useCountUp } from '@/hooks/useCountUp'
import { Card } from './Card'

export type StatCardProps = {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

const trendStyles = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-text-muted',
} as const

/** Numeric stat values count up into place so fresh data lands with weight. */
function CountUpValue({ value }: { value: number }) {
  const display = useCountUp(value)
  return <>{display}</>
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend = 'neutral',
  className,
}: StatCardProps) {
  return (
    <Card padding="md" className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        {icon ? <span className="text-text-muted">{icon}</span> : null}
      </div>

      <p className="font-mono text-3xl font-bold leading-none tracking-tight text-text-primary">
        {typeof value === 'number' ? <CountUpValue value={value} /> : value}
      </p>

      {hint ? (
        <p className={cn('text-xs font-medium', trendStyles[trend])}>{hint}</p>
      ) : null}
    </Card>
  )
}
