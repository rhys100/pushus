import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { cn } from '@/lib/cn'
import type { DayRepSummary } from '@/hooks/useRepHistory'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export type RepCalendarProps = {
  monthStart: Date
  onMonthChange: (monthStart: Date) => void
  selectedDate: string
  onSelectDate: (loggedFor: string) => void
  todayDate: string
  summariesByDate: Map<string, DayRepSummary>
  className?: string
}

function toLoggedFor(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function RepCalendar({
  monthStart,
  onMonthChange,
  selectedDate,
  onSelectDate,
  todayDate,
  summariesByDate,
  className,
}: RepCalendarProps) {
  const monthLabel = format(monthStart, 'MMMM yyyy')
  const gridStart = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const todayParsed = parseISO(`${todayDate}T12:00:00`)

  return (
    <section
      className={cn('rounded-[var(--radius-lg)] border border-border bg-surface p-3', className)}
      aria-label="Rep calendar"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => onMonthChange(subMonths(monthStart, 1))}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--radius-md)] border border-border text-text-muted hover:border-accent/30"
        >
          ‹
        </button>
        <h3 className="text-sm font-semibold text-text-primary">{monthLabel}</h3>
        <button
          type="button"
          aria-label="Next month"
          disabled={isSameMonth(monthStart, todayParsed)}
          onClick={() => onMonthChange(addMonths(monthStart, 1))}
          className={cn(
            'inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--radius-md)] border border-border text-text-muted hover:border-accent/30',
            isSameMonth(monthStart, todayParsed) && 'cursor-not-allowed opacity-40',
          )}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[0.625rem] font-semibold uppercase tracking-wide text-text-muted"
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const loggedFor = toLoggedFor(day)
          const inMonth = isSameMonth(day, monthStart)
          const isSelected = loggedFor === selectedDate
          const isToday = loggedFor === todayDate
          const isFuture = isAfter(day, todayParsed) && !isToday
          const summary = summariesByDate.get(loggedFor)
          const totalReps = summary?.totalReps ?? 0

          return (
            <button
              key={loggedFor}
              type="button"
              disabled={!inMonth || isFuture}
              aria-label={`${format(day, 'd MMMM')}${totalReps > 0 ? `, ${totalReps} reps` : ''}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDate(loggedFor)}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center rounded-[var(--radius-md)] border text-center transition-colors',
                !inMonth && 'invisible pointer-events-none',
                inMonth && !isFuture && 'hover:border-accent/30',
                isSelected
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-transparent text-text-primary',
                isToday && !isSelected && 'ring-1 ring-accent/40',
                isFuture && 'cursor-not-allowed opacity-35',
              )}
            >
              <span className="text-xs font-medium tabular-nums">{format(day, 'd')}</span>
              {totalReps > 0 ? (
                <span className="mt-0.5 font-mono text-[0.625rem] font-semibold tabular-nums text-text-muted">
                  {totalReps}
                </span>
              ) : (
                <span className="mt-0.5 h-[0.625rem]" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
