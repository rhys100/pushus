import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActivityIcon } from '@/components/ui/ActivityIcon'
import { PUSHUPS_ICON } from '@/lib/activityIcons'
import { cn } from '@/lib/cn'
import type { CustomActivity } from '@/types/customActivity'

export type ActivitySwitcherProps = {
  activities: CustomActivity[]
  /** null = the group push-ups logger */
  selectedActivityId: string | null
  onSelect: (activityId: string | null) => void
  disabled?: boolean
  className?: string
}

/**
 * Compact pill above the ring for swapping what the logger banks. Only
 * rendered when the user has custom activities; tapping opens a picker sheet.
 */
export function ActivitySwitcher({
  activities,
  selectedActivityId,
  onSelect,
  disabled = false,
  className,
}: ActivitySwitcherProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const selected = activities.find((activity) => activity.id === selectedActivityId)

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (activities.length === 0) {
    return null
  }

  const choose = (activityId: string | null) => {
    onSelect(activityId)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Logging ${selected ? selected.name : 'Push-ups'} — change activity`}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-full)] border border-border bg-surface px-3.5 py-1.5',
          'text-xs font-semibold text-text-primary transition-colors',
          'hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          disabled && 'opacity-60',
          className,
        )}
      >
        <ActivityIcon
          icon={selected ? selected.emoji : PUSHUPS_ICON}
          className="h-3.5 w-3.5 text-accent"
        />
        <span className="truncate max-w-[12rem]">{selected ? selected.name : 'Push-ups'}</span>
        <svg
          viewBox="0 0 12 12"
          className="h-3 w-3 shrink-0 text-text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[45]" role="dialog" aria-modal="true" aria-label="Choose activity">
          <button
            type="button"
            aria-label="Close activity picker"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-[var(--bottom-nav-height)]">
            <div className="dock-scrim" aria-hidden="true" />
            <div className="dock-panel px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <p className="text-sm font-semibold text-text-primary">Log activity</p>
              <p className="mt-1 text-xs text-text-muted">
                Push-ups count for your group. Custom activities are just for you.
              </p>

              <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto">
                <ActivityOption
                  icon={PUSHUPS_ICON}
                  label="Push-ups"
                  hint="Group goal + leaderboard"
                  selected={selectedActivityId === null}
                  onClick={() => choose(null)}
                />
                {activities.map((activity) => (
                  <ActivityOption
                    key={activity.id}
                    icon={activity.emoji}
                    label={activity.name}
                    hint={activity.track_sides ? 'Left / right tracked' : 'Personal tracking'}
                    selected={selectedActivityId === activity.id}
                    onClick={() => choose(activity.id)}
                  />
                ))}
              </div>

              <button
                type="button"
                className="mt-3 text-xs font-medium text-text-muted underline underline-offset-2 hover:text-text-primary"
                onClick={() => {
                  setOpen(false)
                  navigate('/settings')
                }}
              >
                Manage activities in Settings
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ActivityOption({
  icon,
  label,
  hint,
  selected,
  onClick,
}: {
  icon: string
  label: string
  hint: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-accent bg-accent-muted'
          : 'border-border bg-bg hover:border-accent/30',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <ActivityIcon
          icon={icon}
          className={cn('h-5 w-5 shrink-0', selected ? 'text-accent' : 'text-text-muted')}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-text-primary">{label}</span>
          <span className="block text-xs text-text-muted">{hint}</span>
        </span>
      </span>
      {selected ? (
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m3 8.5 3.2 3.2L13 5" />
        </svg>
      ) : null}
    </button>
  )
}
