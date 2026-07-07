import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useDeleteCustomActivityEntry } from '@/hooks/useCustomActivityLog'
import { formatSelectedDayLabel } from '@/lib/repHistoryFormat'
import type { CustomActivity, CustomActivityEntry } from '@/types/customActivity'

export type CustomDayEntriesListProps = {
  activity: CustomActivity
  entries: CustomActivityEntry[]
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

/** Day set list for a custom activity in Feed → My log; delete is two-tap. */
export function CustomDayEntriesList({
  activity,
  entries,
  selectedDate,
  todayDate,
  loading = false,
  className,
}: CustomDayEntriesListProps) {
  const { toast } = useToast()
  const deleteEntry = useDeleteCustomActivityEntry()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Deleting history is permanent (no undo toast here) — arm for 4s first.
  useEffect(() => {
    if (!confirmDeleteId) {
      return
    }

    const timer = window.setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmDeleteId])

  const heading =
    selectedDate === todayDate || !selectedDate
      ? "Today's sets"
      : formatSelectedDayLabel(selectedDate, todayDate)

  async function handleDelete(entry: CustomActivityEntry) {
    if (confirmDeleteId !== entry.id) {
      setConfirmDeleteId(entry.id)
      return
    }

    setConfirmDeleteId(null)

    try {
      await deleteEntry.mutateAsync({
        entryId: entry.id,
        activityId: entry.activity_id,
        loggedFor: entry.logged_for,
      })
    } catch {
      toast({
        message: 'Could not delete the set. Try again.',
        variant: 'danger',
        durationMs: 5000,
      })
    }
  }

  return (
    <section aria-label={`${activity.name} sets`} className={className}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        {heading}
      </p>

      {loading ? (
        <Skeleton className="h-24 w-full rounded-[var(--radius-lg)]" />
      ) : entries.length === 0 ? (
        <EmptyState
          className="rounded-[var(--radius-lg)] border border-border bg-surface"
          title={`No ${activity.name} this day`}
          description="Sets you bank show up here."
        />
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"
            >
              <p className="font-mono text-lg font-bold tabular-nums text-text-primary">
                {entry.count}
                <span className="ml-1 text-xs font-medium text-text-muted">reps</span>
              </p>
              {entry.side ? (
                <span className="rounded-[var(--radius-full)] border border-border bg-bg px-2 py-0.5 text-[0.6875rem] font-semibold capitalize text-text-muted">
                  {entry.side}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-right text-xs text-text-muted">
                {formatEntryTime(entry.logged_at)}
              </span>
              <Button
                variant={confirmDeleteId === entry.id ? 'danger' : 'ghost'}
                className="min-h-8 shrink-0 px-2.5 text-xs text-danger"
                disabled={deleteEntry.isPending}
                onClick={() => void handleDelete(entry)}
              >
                {confirmDeleteId === entry.id ? 'Confirm?' : 'Delete'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
