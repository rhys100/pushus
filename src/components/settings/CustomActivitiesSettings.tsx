import { useEffect, useState } from 'react'
import { ActivityIcon, Button, Card, useToast } from '@/components/ui'
import {
  activityIconLabel,
  MORE_ACTIVITY_ICON_IDS,
  PRIMARY_ACTIVITY_ICON_IDS,
  type ActivityIconId,
} from '@/lib/activityIcons'
import { cn } from '@/lib/cn'
import { getErrorMessage } from '@/lib/errors'
import {
  useArchiveCustomActivity,
  useArchivedCustomActivities,
  useCreateCustomActivity,
  useCustomActivities,
  useRestoreCustomActivity,
  useUpdateCustomActivity,
} from '@/hooks/useCustomActivities'
import { useAuth } from '@/providers/AuthProvider'
import type { CustomActivity } from '@/types/customActivity'

type EditorState = {
  name: string
  emoji: string
  trackSides: boolean
}

const EMPTY_EDITOR: EditorState = {
  name: '',
  emoji: PRIMARY_ACTIVITY_ICON_IDS[0],
  trackSides: false,
}

function IconPickerButton({
  option,
  selected,
  onSelect,
}: {
  option: ActivityIconId
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Select ${activityIconLabel(option)} icon`}
      aria-pressed={selected}
      title={activityIconLabel(option)}
      onClick={onSelect}
      className={cn(
        'flex h-10 w-full items-center justify-center rounded-[var(--radius-md)]',
        'border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        selected
          ? 'border-accent bg-accent-muted text-accent'
          : 'border-border bg-surface text-text-muted hover:border-accent/30 hover:text-text-primary',
      )}
    >
      <ActivityIcon icon={option} className="h-5 w-5" />
    </button>
  )
}

/**
 * Settings card for personal custom activities (calf raises, pull-ups, …).
 * Adding the first activity is what "enables" the feature — the Log page
 * switcher and Board progress chips appear once one exists.
 */
export function CustomActivitiesSettings() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { data: activities = [], isLoading } = useCustomActivities(user?.id)
  const { data: archivedActivities = [] } = useArchivedCustomActivities(user?.id)
  const createActivity = useCreateCustomActivity()
  const updateActivity = useUpdateCustomActivity()
  const archiveActivity = useArchiveCustomActivity()
  const restoreActivity = useRestoreCustomActivity()

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR)
  const [showMoreIcons, setShowMoreIcons] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)

  // Archive is destructive-ish (no restore UI yet) — first tap arms the
  // button, second tap within 4s confirms.
  useEffect(() => {
    if (!confirmArchiveId) {
      return
    }

    const timer = window.setTimeout(() => setConfirmArchiveId(null), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmArchiveId])

  if (!user) {
    return null
  }

  const saving =
    createActivity.isPending ||
    updateActivity.isPending ||
    archiveActivity.isPending ||
    restoreActivity.isPending

  function openAdd() {
    setEditor(EMPTY_EDITOR)
    setEditingId(null)
    setShowMoreIcons(false)
    setAdding(true)
  }

  function openEdit(activity: CustomActivity) {
    setEditor({
      name: activity.name,
      emoji: activity.emoji,
      trackSides: activity.track_sides,
    })
    setEditingId(activity.id)
    // Keep the current icon visible if it lives behind the More toggle.
    setShowMoreIcons(MORE_ACTIVITY_ICON_IDS.includes(activity.emoji as ActivityIconId))
    setAdding(false)
  }

  function closeEditor() {
    setAdding(false)
    setEditingId(null)
    setShowMoreIcons(false)
    setEditor(EMPTY_EDITOR)
  }

  async function handleSave() {
    const name = editor.name.trim()

    if (!name) {
      toast({ message: 'Activity name is required.', variant: 'danger' })
      return
    }

    try {
      if (editingId) {
        await updateActivity.mutateAsync({
          userId: user!.id,
          activityId: editingId,
          name,
          emoji: editor.emoji,
          trackSides: editor.trackSides,
        })
        toast({ message: 'Activity updated.', variant: 'success' })
      } else {
        await createActivity.mutateAsync({
          userId: user!.id,
          name,
          emoji: editor.emoji,
          trackSides: editor.trackSides,
        })
        toast({
          message: `${name} added — pick it from the Log page to start banking.`,
          variant: 'success',
          durationMs: 6000,
        })
      }

      closeEditor()
    } catch (error) {
      toast({
        message: getErrorMessage(error, 'Could not save activity.'),
        variant: 'danger',
      })
    }
  }

  async function handleRestore(activity: CustomActivity) {
    try {
      await restoreActivity.mutateAsync({ userId: user!.id, activityId: activity.id })
      toast({
        message: `${activity.name} restored — history and progress are back.`,
        variant: 'success',
        durationMs: 5000,
      })
    } catch (error) {
      // Most likely cause: an active activity now uses the same name
      // (unique per user), so surface the raw message as a hint.
      toast({
        message: getErrorMessage(error, 'Could not restore activity.'),
        variant: 'danger',
      })
    }
  }

  async function handleArchive(activity: CustomActivity) {
    if (confirmArchiveId !== activity.id) {
      setConfirmArchiveId(activity.id)
      return
    }

    setConfirmArchiveId(null)

    try {
      await archiveActivity.mutateAsync({ userId: user!.id, activityId: activity.id })
      toast({
        message: `${activity.name} archived. Your history is kept.`,
        variant: 'default',
        durationMs: 5000,
      })

      if (editingId === activity.id) {
        closeEditor()
      }
    } catch (error) {
      toast({
        message: getErrorMessage(error, 'Could not archive activity.'),
        variant: 'danger',
      })
    }
  }

  const editorOpen = adding || editingId != null

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">Custom activities</p>
          <p className="mt-1 text-xs text-text-muted">
            Track extra reps just for you — calf raises, pull-ups, leg raises. They show
            on your Log page and progress chart, never on the group board.
          </p>
        </div>
        {!editorOpen ? (
          <Button
            variant="secondary"
            className="min-h-9 shrink-0 px-3 text-sm"
            disabled={saving}
            onClick={openAdd}
          >
            Add
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading activities…</p>
      ) : activities.length === 0 && !editorOpen ? (
        <p className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-3 text-xs text-text-muted">
          No custom activities yet. Add one to get an activity switcher on the Log page.
        </p>
      ) : null}

      {activities.length > 0 ? (
        <ul className="space-y-2">
          {activities.map((activity) => (
            <li
              key={activity.id}
              className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface text-accent">
                <ActivityIcon icon={activity.emoji} className="h-5 w-5 text-lg" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary" title={activity.name}>
                  {activity.name}
                </p>
                {activity.track_sides ? (
                  <p className="truncate text-2xs text-text-muted">Left / right tracked</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  className="min-h-9 px-2 text-xs"
                  disabled={saving}
                  onClick={() => openEdit(activity)}
                >
                  Edit
                </Button>
                <Button
                  variant={confirmArchiveId === activity.id ? 'danger' : 'ghost'}
                  className={cn(
                    'min-h-9 px-2 text-xs',
                    confirmArchiveId !== activity.id && 'text-danger',
                  )}
                  disabled={saving}
                  onClick={() => void handleArchive(activity)}
                >
                  {confirmArchiveId === activity.id ? 'Confirm?' : 'Archive'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {editorOpen ? (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-3">
          <div className="space-y-1.5">
            <label
              htmlFor="customActivityName"
              className="text-xs font-medium text-text-muted"
            >
              Name
            </label>
            <input
              id="customActivityName"
              type="text"
              maxLength={40}
              placeholder="e.g. Calf raises (single leg)"
              value={editor.name}
              onChange={(event) =>
                setEditor((current) => ({ ...current, name: event.target.value }))
              }
              className={cn(
                'w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5',
                'text-sm text-text-primary placeholder:text-text-muted/70',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              )}
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-text-muted">Icon</span>
            <div className="grid grid-cols-5 gap-2">
              {PRIMARY_ACTIVITY_ICON_IDS.map((option) => (
                <IconPickerButton
                  key={option}
                  option={option}
                  selected={editor.emoji === option}
                  onSelect={() => setEditor((current) => ({ ...current, emoji: option }))}
                />
              ))}
            </div>

            {showMoreIcons ? (
              <div className="grid grid-cols-5 gap-2">
                {MORE_ACTIVITY_ICON_IDS.map((option) => (
                  <IconPickerButton
                    key={option}
                    option={option}
                    selected={editor.emoji === option}
                    onSelect={() => setEditor((current) => ({ ...current, emoji: option }))}
                  />
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setShowMoreIcons((current) => !current)}
              className="text-xs font-medium text-accent underline underline-offset-2"
            >
              {showMoreIcons ? 'Fewer icons' : 'More icons'}
            </button>
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              checked={editor.trackSides}
              onChange={(event) =>
                setEditor((current) => ({ ...current, trackSides: event.target.checked }))
              }
            />
            <span>
              <span className="block text-sm text-text-primary">
                Track left and right separately
              </span>
              <span className="block text-xs text-text-muted">
                For single-side work like one-legged calf raises — pick the side each
                time you bank a set.
              </span>
            </span>
          </label>

          <div className="flex gap-2">
            <Button
              className="min-h-10 flex-1"
              loading={createActivity.isPending || updateActivity.isPending}
              onClick={() => void handleSave()}
            >
              {editingId ? 'Save changes' : 'Add activity'}
            </Button>
            <Button
              variant="secondary"
              className="min-h-10 flex-1"
              disabled={saving}
              onClick={closeEditor}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {archivedActivities.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowArchived((current) => !current)}
            className="text-xs font-medium text-text-muted underline underline-offset-2 hover:text-text-primary"
          >
            {showArchived
              ? 'Hide archived'
              : `Archived (${archivedActivities.length})`}
          </button>

          {showArchived ? (
            <ul className="space-y-2">
              {archivedActivities.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border/60 bg-bg px-3 py-2.5 opacity-80"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface text-text-muted">
                    <ActivityIcon icon={activity.emoji} className="h-5 w-5 text-lg" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary" title={activity.name}>
                      {activity.name}
                    </p>
                    <p className="truncate text-2xs text-text-muted">
                      History kept — restore to keep logging
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="min-h-9 shrink-0 px-2.5 text-xs text-accent"
                    disabled={saving}
                    onClick={() => void handleRestore(activity)}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
