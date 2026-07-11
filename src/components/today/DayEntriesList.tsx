import { memo, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import type { Group } from '@/types/database'
import type { PushupEntry } from '@/types/pushupEntry'
import { useDeleteEntry, useUpdateEntry } from '@/hooks/useTodayData'
import { isDeletableDay, isEditableDay } from '@/lib/entryEditWindow'
import { getErrorMessage } from '@/lib/errors'
import { formatEntryTime, formatSelectedDayLabel } from '@/lib/repHistoryFormat'

export type DayEntriesListProps = {
  group: Group
  entries: PushupEntry[]
  selectedDate: string
  todayDate: string
  loading?: boolean
  className?: string
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
  canEdit: boolean
  canDelete: boolean
}

const EntryRow = memo(function EntryRow({ group, entry, canEdit, canDelete }: EntryRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftCount, setDraftCount] = useState(String(entry.count))
  const { toast } = useToast()
  const updateEntry = useUpdateEntry()
  const deleteEntry = useDeleteEntry()
  const isBusy = updateEntry.isPending || deleteEntry.isPending
  const entryTime = useMemo(() => formatEntryTime(entry.created_at), [entry.created_at])
  // Deleting an entry is permanent (adjusts totals/streak/XP), so arm-to-confirm
  // first — matching the custom-activity list. Auto-disarms after 4s.
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (!confirmingDelete) return
    const timer = window.setTimeout(() => setConfirmingDelete(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmingDelete])

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
    } catch (error) {
      setDraftCount(String(entry.count))
      toast({
        message: getErrorMessage(error, 'Could not save that change.'),
        variant: 'danger',
        durationMs: 5000,
      })
    }
  }

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    setConfirmingDelete(false)
    try {
      await deleteEntry.mutateAsync({
        group,
        entryId: entry.id,
        loggedFor: entry.logged_for,
      })
    } catch (error) {
      // Cache rollback is handled by the mutation's onError; surface why it failed.
      toast({
        message: getErrorMessage(error, 'Could not delete that entry.'),
        variant: 'danger',
        durationMs: 5000,
      })
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
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleSave()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setDraftCount(String(entry.count))
                  setIsEditing(false)
                }
              }}
              autoFocus
              className="w-20 rounded-[var(--radius-md)] border border-border bg-bg px-2 py-1.5 font-mono text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/30"
              aria-label="Edit rep count"
            />
            <Button
              variant="secondary"
              className="min-h-11 px-3 py-1.5 text-xs"
              loading={updateEntry.isPending}
              onClick={handleSave}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              className="min-h-11 px-3 py-1.5 text-xs"
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

        {confirmingDelete ? (
          <p className="mt-1 text-xs font-medium text-danger">Tap again to delete</p>
        ) : null}
      </div>

      {!isEditing && (canEdit || canDelete) ? (
        <div className="flex shrink-0 items-center gap-1">
          {canEdit ? (
            <Button
              variant="ghost"
              className="min-h-11 min-w-11 px-2 text-xs"
              disabled={isBusy || entry.id.startsWith('optimistic-')}
              onClick={() => {
                setConfirmingDelete(false)
                setDraftCount(String(entry.count))
                setIsEditing(true)
              }}
            >
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant={confirmingDelete ? 'danger' : 'ghost'}
              className="min-h-11 min-w-11 px-2 text-xs"
              loading={deleteEntry.isPending}
              disabled={isBusy || entry.id.startsWith('optimistic-')}
              aria-label={confirmingDelete ? 'Confirm delete entry' : 'Delete entry'}
              onClick={handleDelete}
            >
              {confirmingDelete ? 'Confirm?' : 'Delete'}
            </Button>
          ) : null}
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
  const day = selectedDate || todayDate
  const canEdit = isEditableDay(day, todayDate)
  const canDelete = isDeletableDay(day, todayDate)
  const locked = Boolean(todayDate) && !canEdit && !canDelete

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
          <EntryRow
            key={entry.id}
            group={group}
            entry={entry}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))}
      </ul>

      {locked ? (
        <p className="mt-2 px-1 text-xs text-text-muted">
          🔒 This day is locked. You can only change today and yesterday.
        </p>
      ) : null}
    </section>
  )
})
