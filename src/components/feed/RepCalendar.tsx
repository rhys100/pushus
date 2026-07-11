import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
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
import { tapHaptic } from '@/lib/haptics'
import { Skeleton } from '@/components/ui'
import type { DayRepSummary } from '@/hooks/useRepHistory'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export type RepCalendarProps = {
  monthStart: Date
  onMonthChange: (monthStart: Date) => void
  selectedDate: string
  onSelectDate: (loggedFor: string) => void
  todayDate: string
  summariesByDate: Map<string, DayRepSummary>
  loading?: boolean
  className?: string
}

function toLoggedFor(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Per-cell data that only depends on the visible month + today. */
type CalendarCell = {
  loggedFor: string
  dayNum: string
  dateLabel: string
  inMonth: boolean
  isToday: boolean
  isFuture: boolean
  animationDelay: string
}

/**
 * A single day button. Memoised so a day-tap (which changes selectedDate) only
 * re-renders the two cells whose selection flipped — not all 42, and without
 * re-running date-fns per cell.
 */
const CalendarDay = memo(function CalendarDay({
  cell,
  isSelected,
  totalReps,
  loading,
  onSelect,
}: {
  cell: CalendarCell
  isSelected: boolean
  totalReps: number
  loading: boolean
  onSelect: (loggedFor: string) => void
}) {
  const { loggedFor, dayNum, dateLabel, inMonth, isToday, isFuture, animationDelay } = cell

  return (
    <button
      type="button"
      disabled={!inMonth || isFuture}
      aria-label={`${dateLabel}${isToday ? ', today' : ''}${totalReps > 0 ? `, ${totalReps} reps` : ''}`}
      aria-pressed={isSelected}
      onClick={() => {
        if (!isSelected) {
          tapHaptic()
        }
        onSelect(loggedFor)
      }}
      style={{ animationDelay }}
      className={cn(
        'cal-pop flex min-h-11 flex-col items-center justify-center rounded-[var(--radius-md)] border text-center',
        'transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] active:scale-90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60',
        !inMonth && 'invisible pointer-events-none',
        inMonth && !isFuture && 'hover:border-accent/30',
        isSelected
          ? 'border-accent bg-accent-muted text-accent'
          : 'border-transparent text-text-primary',
        isToday && !isSelected && 'ring-1 ring-accent/40',
        isFuture && 'cursor-not-allowed opacity-35',
      )}
    >
      <span className="text-xs font-medium tabular-nums">{dayNum}</span>
      {loading && inMonth && !isFuture ? (
        <Skeleton className="mt-0.5 h-[0.625rem] w-4" rounded="full" />
      ) : totalReps > 0 ? (
        <span
          className={cn(
            'mt-0.5 font-mono text-[0.625rem] font-semibold tabular-nums',
            isSelected ? 'text-accent/70' : 'text-text-muted',
          )}
        >
          {totalReps}
        </span>
      ) : (
        <span className="mt-0.5 h-[0.625rem]" aria-hidden="true" />
      )}
    </button>
  )
})

export function RepCalendar({
  monthStart,
  onMonthChange,
  selectedDate,
  onSelectDate,
  todayDate,
  summariesByDate,
  loading = false,
  className,
}: RepCalendarProps) {
  // Only depends on the visible month + today — recompute the grid and every
  // cell's static geometry when those change, not on each day-tap (which only
  // changes selectedDate and re-renders this component).
  const { monthLabel, cells, todayParsed } = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 })
    const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
    const todayParsedDate = parseISO(`${todayDate}T12:00:00`)
    const cellData: CalendarCell[] = days.map((day, dayIndex) => {
      const loggedFor = toLoggedFor(day)
      const isToday = loggedFor === todayDate
      return {
        loggedFor,
        dayNum: format(day, 'd'),
        dateLabel: format(day, 'd MMMM'),
        inMonth: isSameMonth(day, monthStart),
        isToday,
        isFuture: isAfter(day, todayParsedDate) && !isToday,
        animationDelay: `${dayIndex * 6}ms`,
      }
    })
    return {
      monthLabel: format(monthStart, 'MMMM yyyy'),
      cells: cellData,
      todayParsed: todayParsedDate,
    }
  }, [monthStart, todayDate])

  // Stable select callback so the memoised day cells don't all re-render when
  // the parent hands us a fresh onSelectDate identity on each render.
  const onSelectRef = useRef(onSelectDate)
  useEffect(() => {
    onSelectRef.current = onSelectDate
  })
  const selectDay = useCallback((loggedFor: string) => {
    onSelectRef.current(loggedFor)
  }, [])

  return (
    <section
      className={cn('rounded-[var(--radius-lg)] border border-border bg-surface p-3', className)}
      aria-label="Rep calendar"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => {
            tapHaptic()
            onMonthChange(subMonths(monthStart, 1))
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] border border-border text-text-muted transition-transform duration-[var(--duration-fast)] hover:border-accent/30 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          ‹
        </button>
        <h3 key={monthLabel} className="motion-fade text-sm font-semibold text-text-primary">
          {monthLabel}
        </h3>
        <button
          type="button"
          aria-label="Next month"
          disabled={isSameMonth(monthStart, todayParsed)}
          onClick={() => {
            tapHaptic()
            onMonthChange(addMonths(monthStart, 1))
          }}
          className={cn(
            'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] border border-border text-text-muted transition-transform duration-[var(--duration-fast)] hover:border-accent/30 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
            isSameMonth(monthStart, todayParsed) && 'cursor-not-allowed opacity-40',
          )}
        >
          ›
        </button>
      </div>

      {/* Keyed by month so the cell cascade replays on every month turn */}
      <div key={monthLabel} className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[0.625rem] font-semibold uppercase tracking-wide text-text-muted"
          >
            {label}
          </div>
        ))}

        {cells.map((cell) => (
          <CalendarDay
            key={cell.loggedFor}
            cell={cell}
            isSelected={cell.loggedFor === selectedDate}
            totalReps={summariesByDate.get(cell.loggedFor)?.totalReps ?? 0}
            loading={loading}
            onSelect={selectDay}
          />
        ))}
      </div>
    </section>
  )
}
