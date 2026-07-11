import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { AvatarChip, Button, Skeleton, useToast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/lib/errors'
import type { FeedVisibility, Group, OversizeEntryPolicy } from '@/types/database'

type PendingEntry = {
  id: string
  user_id: string
  display_name: string
  avatar_emoji: string
  count: number
  logged_for: string
  created_at: string
}

const OVERSIZE_OPTIONS: { value: OversizeEntryPolicy; label: string }[] = [
  { value: 'warn', label: 'Warn — allow but nudge honesty' },
  { value: 'block', label: 'Block — reject oversize banks' },
  { value: 'admin_review', label: 'Review — hold for admin approval' },
]

const FEED_VISIBILITY_OPTIONS: { value: FeedVisibility; label: string }[] = [
  { value: 'full_entries', label: 'Full entries — every bank shows' },
  { value: 'daily_totals', label: 'Daily totals only' },
  { value: 'leaderboard_totals', label: 'Leaderboard totals only' },
]

const selectClass =
  'w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-text-primary'

/** Admin-only: dodgy-entry review queue plus entry/feed policy settings. */
export function EntryModerationSettings({ group }: { group: Group }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const pendingQuery = useQuery({
    queryKey: ['pending-entries', group.id],
    queryFn: async (): Promise<PendingEntry[]> => {
      const { data, error } = await supabase.rpc('list_pending_entries', {
        p_group_id: group.id,
      })
      if (error) throw error
      const parsed = typeof data === 'string' ? JSON.parse(data) : data
      return Array.isArray(parsed) ? (parsed as PendingEntry[]) : []
    },
    refetchInterval: 30_000,
  })

  const reviewMutation = useMutation({
    mutationFn: async (input: { entryId: string; approve: boolean }) => {
      const { error } = await supabase.rpc('review_entry', {
        p_entry_id: input.entryId,
        p_approve: input.approve,
      })
      if (error) throw error
    },
    onSuccess: (_, input) => {
      toast({
        message: input.approve ? 'Entry approved.' : 'Entry rejected — it no longer counts.',
        variant: 'success',
      })
      void queryClient.invalidateQueries({ queryKey: ['pending-entries', group.id] })
    },
    onError: (error: Error) => {
      toast({ message: getErrorMessage(error, 'Could not review entry.'), variant: 'danger' })
    },
  })

  const settingsMutation = useMutation({
    mutationFn: async (patch: Partial<Pick<Group, 'oversize_entry_policy' | 'feed_visibility'>>) => {
      const { error } = await supabase.from('groups').update(patch).eq('id', group.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ message: 'Group setting saved.', variant: 'success' })
      void queryClient.invalidateQueries({ queryKey: ['groups'] })
      void queryClient.invalidateQueries({ queryKey: ['active-group'] })
    },
    onError: (error: Error) => {
      toast({ message: getErrorMessage(error, 'Could not save setting.'), variant: 'danger' })
    },
  })

  const pending = pendingQuery.data ?? []
  // While one entry is being reviewed, only its acted button spins and the
  // rest of the queue is disabled — a shared isPending spun every row's
  // Approve *and* Reject, hiding which action was actually in flight.
  const processing = reviewMutation.isPending ? reviewMutation.variables : undefined

  return (
    <div className="space-y-4">
      {pending.length > 0 || pendingQuery.isLoading ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Entries awaiting review
          </p>
          {pendingQuery.isLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : (
            pending.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2"
              >
                <AvatarChip
                  emoji={entry.avatar_emoji}
                  name={entry.display_name}
                  subtitle={`${entry.count} reps · ${format(parseISO(`${entry.logged_for}T12:00:00`), 'd MMM yyyy')}`}
                  className="flex-1 border-0 bg-transparent p-0"
                />
                <Button
                  className="min-h-9 px-3 text-xs"
                  loading={processing?.entryId === entry.id && processing.approve === true}
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ entryId: entry.id, approve: true })}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  className="min-h-9 px-3 text-xs"
                  loading={processing?.entryId === entry.id && processing.approve === false}
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ entryId: entry.id, approve: false })}
                >
                  Reject
                </Button>
              </div>
            ))
          )}
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-text-muted">
          Oversize entries (over {group.max_single_entry} reps in one bank)
        </span>
        <select
          className={selectClass}
          value={group.oversize_entry_policy ?? 'warn'}
          disabled={settingsMutation.isPending}
          onChange={(event) =>
            settingsMutation.mutate({
              oversize_entry_policy: event.target.value as OversizeEntryPolicy,
            })
          }
        >
          {OVERSIZE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-text-muted">Feed visibility</span>
        <select
          className={selectClass}
          value={group.feed_visibility ?? 'full_entries'}
          disabled={settingsMutation.isPending}
          onChange={(event) =>
            settingsMutation.mutate({ feed_visibility: event.target.value as FeedVisibility })
          }
        >
          {FEED_VISIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
