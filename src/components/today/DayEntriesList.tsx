import { memo, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Group } from '@/types/database'
import type { PushupEntry } from '@/types/pushupEntry'
import { useDeleteEntry, useUpdateEntry } from '@/hooks/useTodayData'
import { formatSelectedDayLabel } from '@/lib/repHistoryFormat'

export type DayEntriesListProps = {
  group: Group
  entries: PushupEntry[]
  selectedDate: string
  todayDate: string
  loading?: boolean
  className?: string
}

function formatEntryTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a')
  } catch {
    return '—'
  }
}

function formatSectionHeading(selectedDate: string, todayDate: string): string {
  if (!selectedDate) {
    return "Today's entries"
  }

  if (selectedDate === todayDate) {
    return "Today's entries"
  }

  return formatSelectedDayLabel(selectedDate, todayDate)
}

type EntryRowProps = {
  group: Group
  entry: PushupEntry
}

const EntryRow = memo(function EntryRow({ group, entry }: EntryRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftCount, setDraftCount] = useState(String(entry.count))
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()
  const isBusy = updateEntry.isPending || deleteEntry.isPending
  const entryTime = useMemo(() => formatEntryTime(entry.created_at), [entry.created_at])

  const handleSave = async () => {
    const nextCount = Number.parseInt(draftCount, 10)

    if (!Number.isFinite(nextCount) || nextCount <= 0) {
      setDraftCount(String(entry.count))
      setIsEditing(false)
      return
    }

    if (nextCount === entry.count) {
      setIsEditing(false)
      return
    }

    try {
      await updateEntry.mutateAsync({
        group,
        entryId: entry.id,
        count: nextCount,
        loggedFor: entry.logged_for,
      })
      setIsEditing(false)
    } catch {
      setDraftCount(String(entry.count))
    }
  }

  const handleDelete = async () => {
    try {
      await deleteEntry.mutateAsync({
        group,
        entryId: entry.id,
        loggedFor: entry.logged_for,
      })
    } catch {
      // Rollback handled by mutation onError
    }
  }

  return (
    <li className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-muted">{entryTime}</p>

        {isEditing ? (
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={draftCount}
              onChange={(event) => setDraftCount(event.target.value)}
              className="w-20 rounded-[var(--radius-md)] border border-border bg-bg px-2 py-1.5 font-mono text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/30"
              aria-label="Edit rep count"
            />
            <Button
              variant="secondary"
              className="min-h-9 px-3 py-1.5 text-xs"
              loading={updateEntry.isPending}
              onClick={handleSave}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              className="min-h-9 px-3 py-1.5 text-xs"
              disabled={isBusy}
              onClick={() => {
                setDraftCount(String(entry.count))
                setIsEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p className="mt-0.5 font-mono text-lg font-semibold text-text-primary">
            {entry.count}
            <span className="ml-1 text-sm font-medium text-text-muted">reps</span>
            {entry.reps_in_reserve !== null ? (
              <span className="ml-2 text-sm font-normal text-text-muted">
                (+{entry.reps_in_reserve} left)
              </span>
            ) : null}
          </p>
        )}
      </div>

      {!isEditing ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            className="min-h-9 min-w-9 px-2 text-xs"
            disabled={isBusy || entry.id.startsWith('optimistic-')}
            onClick={() => {
              setDraftCount(String(entry.count))
              setIsEditing(true)
            }}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            className="min-h-9 min-w-9 px-2 text-xs"
            loading={deleteEntry.isPending}
            disabled={isBusy || entry.id.startsWith('optimistic-')}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </li>
  )
})

export const DayEntriesList = memo(function DayEntriesList({
  group,
  entries,
  selectedDate,
  todayDate,
  loading = false,
  className,
}: DayEntriesListProps) {
  const heading = formatSectionHeading(selectedDate, todayDate)
  const ariaLabel = selectedDate === todayDate ? "Today's entries" : `Entries for ${heading}`

  if (loading) {
    return (
      <section className={cn('mt-5', className)} aria-label={ariaLabel}>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">{heading}</h2>
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          <Skeleton className="h-14 rounded-none" />
          <Skeleton className="mt-px h-14 rounded-none" />
        </div>
      </section>
    )
  }

  if (entries.length === 0) {
    return (
      <section className={cn('mt-5', className)} aria-label={ariaLabel}>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">{heading}</h2>
        <EmptyState
          className="rounded-[var(--radius-lg)] border border-border bg-surface py-8"
          title="No sets banked."
          description={
            selectedDate === todayDate
              ? 'Bank a set from the Log tab.'
              : 'No push-ups logged on this day.'
          }
        />
      </section>
    )
  }

  return (
    <section className={cn('mt-5', className)} aria-label={ariaLabel}>
      <h2 className="mb-3 text-sm font-semibold text-text-primary">{heading}</h2>

      <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
        {entries.map((entry) => (
          <EntryRow key={entry.id} group={group} entry={entry} />
        ))}
      </ul>
    </section>
  )
})
