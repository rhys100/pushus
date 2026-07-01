import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth } from 'date-fns'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  aggregateRepSummaryByDate,
  useRepHistorySummary,
} from '@/hooks/useRepHistory'
import {
  getGroupLocalDateString,
  useDayEntries,
  useDayTotal,
} from '@/hooks/useTodayData'
import { useAuth } from '@/providers/AuthProvider'
import { DayEntriesList } from '@/components/today/DayEntriesList'
import { Skeleton } from '@/components/ui/Skeleton'
import { RepCalendar } from '@/components/feed/RepCalendar'

export function RepHistoryPanel() {
  const { user } = useAuth()
  const { activeGroup } = useActiveGroup()
  const todayDate = activeGroup ? getGroupLocalDateString(activeGroup.timezone) : ''
  const [selectedDate, setSelectedDate] = useState('')
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))

  useEffect(() => {
    if (!todayDate) {
      return
    }

    setSelectedDate((current) => current || todayDate)
    setMonthStart(startOfMonth(parseISO(`${todayDate}T12:00:00`)))
  }, [todayDate])

  const { data: monthSummary = [], isLoading: summaryLoading } = useRepHistorySummary(
    activeGroup,
    user?.id,
    monthStart,
  )
  const { data: dayTotal = 0, isLoading: totalLoading } = useDayTotal(
    activeGroup,
    selectedDate || undefined,
  )
  const { data: entries = [], isLoading: entriesLoading } = useDayEntries(
    activeGroup,
    user?.id,
    selectedDate || undefined,
  )

  const summariesByDate = useMemo(
    () => aggregateRepSummaryByDate(monthSummary),
    [monthSummary],
  )

  if (!activeGroup || !user || !todayDate) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-[var(--radius-lg)]" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
      </div>
    )
  }

  const selectedHeading =
    selectedDate === todayDate
      ? 'Today'
      : format(parseISO(`${selectedDate}T12:00:00`), 'EEE d MMM')

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {selectedHeading}
        </p>
        {totalLoading && dayTotal === 0 ? (
          <Skeleton className="mt-2 h-8 w-24" />
        ) : (
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-text-primary">
            {dayTotal}
            <span className="ml-1.5 text-sm font-medium text-text-muted">reps</span>
            {entries.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-text-muted">
                · {entries.length} set{entries.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </p>
        )}
      </div>

      <RepCalendar
        monthStart={monthStart}
        onMonthChange={(nextMonth) => {
          setMonthStart(nextMonth)
        }}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        todayDate={todayDate}
        summariesByDate={summariesByDate}
      />

      {summaryLoading && monthSummary.length === 0 ? (
        <Skeleton className="h-32 w-full rounded-[var(--radius-lg)]" />
      ) : null}

      <DayEntriesList
        group={activeGroup}
        entries={entries}
        selectedDate={selectedDate}
        todayDate={todayDate}
        loading={entriesLoading && entries.length === 0}
        className="mt-0"
      />
    </div>
  )
}
