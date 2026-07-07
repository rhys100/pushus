import { useEffect, useMemo, useState } from 'react'
import { parseISO, startOfMonth } from 'date-fns'
import { cn } from '@/lib/cn'
import { PUSHUPS_ICON } from '@/lib/activityIcons'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useCustomActivities } from '@/hooks/useCustomActivities'
import {
  useCustomActivityDayEntries,
  useCustomActivityMonthSummary,
} from '@/hooks/useCustomActivityLog'
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
import { CustomDayEntriesList } from '@/components/feed/CustomDayEntriesList'
import { DayEntriesList } from '@/components/today/DayEntriesList'
import { ActivityIcon, EmptyState, Skeleton } from '@/components/ui'
import { RepCalendar } from '@/components/feed/RepCalendar'
import { formatSelectedDayLabel } from '@/lib/repHistoryFormat'

export function RepHistoryPanel() {
  const { user } = useAuth()
  const { activeGroup } = useActiveGroup()
  const todayDate = activeGroup ? getGroupLocalDateString(activeGroup.timezone) : ''
  const [selectedDate, setSelectedDate] = useState('')
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)

  const { data: customActivities = [] } = useCustomActivities(user?.id)
  const selectedActivity =
    customActivities.find((activity) => activity.id === selectedActivityId) ?? null
  const isCustom = selectedActivity != null

  useEffect(() => {
    if (!todayDate) {
      return
    }

    setSelectedDate((current) => current || todayDate)
    setMonthStart(startOfMonth(parseISO(`${todayDate}T12:00:00`)))
  }, [todayDate])

  const ready = Boolean(activeGroup && user && todayDate && selectedDate)

  // Push-ups history (disabled while a custom activity is selected).
  const pushupsGroup = isCustom ? null : activeGroup
  const {
    data: monthSummary = [],
    isLoading: summaryLoading,
    isError: summaryError,
  } = useRepHistorySummary(pushupsGroup, user?.id, monthStart)
  const {
    data: dayTotal = 0,
    isLoading: totalLoading,
    isError: totalError,
  } = useDayTotal(pushupsGroup, ready ? selectedDate : undefined)
  const {
    data: entries = [],
    isLoading: entriesLoading,
    isError: entriesError,
  } = useDayEntries(pushupsGroup, user?.id, ready ? selectedDate : undefined)

  // Custom activity history.
  const {
    data: customMonthSummary = [],
    isLoading: customSummaryLoading,
    isError: customSummaryError,
  } = useCustomActivityMonthSummary(selectedActivity?.id, monthStart)
  const {
    data: customEntries = [],
    isLoading: customEntriesLoading,
    isError: customEntriesError,
  } = useCustomActivityDayEntries(selectedActivity?.id, ready ? selectedDate : '')

  const summariesByDate = useMemo(
    () => aggregateRepSummaryByDate(isCustom ? customMonthSummary : monthSummary),
    [customMonthSummary, isCustom, monthSummary],
  )

  const customDayTotal = useMemo(
    () => customEntries.reduce((sum, entry) => sum + entry.count, 0),
    [customEntries],
  )

  if (!ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-[var(--radius-lg)]" />
        <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
      </div>
    )
  }

  const hasError = isCustom
    ? customSummaryError || customEntriesError
    : summaryError || totalError || entriesError

  if (hasError) {
    return (
      <EmptyState
        className="rounded-[var(--radius-lg)] border border-border bg-surface"
        title="Could not load your log"
        description="Check your connection and try again."
      />
    )
  }

  const selectedHeading = formatSelectedDayLabel(selectedDate, todayDate)
  const displayTotal = isCustom ? customDayTotal : dayTotal
  const displaySets = isCustom ? customEntries.length : entries.length
  const totalIsLoading = isCustom
    ? customEntriesLoading && customEntries.length === 0
    : totalLoading && dayTotal === 0
  const monthIsLoading = isCustom
    ? customSummaryLoading && customMonthSummary.length === 0
    : summaryLoading && monthSummary.length === 0

  return (
    <div className="space-y-4">
      {customActivities.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Log history activity">
          <HistoryChip
            icon={PUSHUPS_ICON}
            label="Push-ups"
            selected={!isCustom}
            onClick={() => setSelectedActivityId(null)}
          />
          {customActivities.map((activity) => (
            <HistoryChip
              key={activity.id}
              icon={activity.emoji}
              label={activity.name}
              selected={selectedActivityId === activity.id}
              onClick={() => setSelectedActivityId(activity.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {isCustom && selectedActivity ? `${selectedActivity.name} — ` : ''}
          {selectedHeading}
        </p>
        {totalIsLoading ? (
          <Skeleton className="mt-2 h-8 w-24" />
        ) : (
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-text-primary">
            {displayTotal}
            <span className="ml-1.5 text-sm font-medium text-text-muted">reps</span>
            {displaySets > 0 ? (
              <span className="ml-2 text-sm font-normal text-text-muted">
                · {displaySets} set{displaySets === 1 ? '' : 's'}
              </span>
            ) : null}
          </p>
        )}
      </div>

      <RepCalendar
        monthStart={monthStart}
        onMonthChange={setMonthStart}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        todayDate={todayDate}
        summariesByDate={summariesByDate}
      />

      {monthIsLoading ? (
        <Skeleton className="h-32 w-full rounded-[var(--radius-lg)]" />
      ) : null}

      {isCustom && selectedActivity ? (
        <CustomDayEntriesList
          activity={selectedActivity}
          entries={customEntries}
          selectedDate={selectedDate}
          todayDate={todayDate}
          loading={customEntriesLoading && customEntries.length === 0}
        />
      ) : (
        <DayEntriesList
          group={activeGroup!}
          entries={entries}
          selectedDate={selectedDate}
          todayDate={todayDate}
          loading={entriesLoading && entries.length === 0}
          className="mt-0"
        />
      )}
    </div>
  )
}

function HistoryChip({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: string
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] border px-3 py-1.5 text-xs font-semibold transition-colors',
        selected
          ? 'border-accent bg-accent-muted text-accent'
          : 'border-border bg-bg text-text-muted hover:border-accent/30',
      )}
    >
      <ActivityIcon icon={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
