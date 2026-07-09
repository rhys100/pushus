import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { useBankPushups } from '@/hooks/useTodayData'
import { useAuth } from '@/providers/AuthProvider'
import type { Group } from '@/types/database'

type AddSetForDayProps = {
  group: Group
  /** Group-local ISO date (`yyyy-MM-dd`) to log the set against. */
  loggedFor: string
  /** Human label for the day, e.g. "Mon 8 Jul". */
  dayLabel: string
}

/**
 * Log a set the user forgot to bank on a past day. Only mounted for days inside
 * the edit window (yesterday); the server still enforces the backdate policy.
 */
export function AddSetForDay({ group, loggedFor, dayLabel }: AddSetForDayProps) {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const bankPushups = useBankPushups()
  const [value, setValue] = useState('')

  const count = Number.parseInt(value, 10)
  const isValid = Number.isFinite(count) && count > 0

  async function handleAdd() {
    if (!isValid || !user || !profile || bankPushups.isPending) {
      return
    }

    try {
      await bankPushups.mutateAsync({
        group,
        count,
        userId: user.id,
        profile: {
          user_id: user.id,
          display_name: profile.display_name,
          avatar_emoji: profile.avatar_emoji,
          avatar_color: profile.avatar_color,
        },
        loggedFor,
      })
      setValue('')
      toast({
        message: `Added ${count} to ${dayLabel} · +${count} XP`,
        variant: 'success',
        durationMs: 5000,
      })
    } catch {
      toast({
        message: `Could not add to ${dayLabel}. That day may be locked.`,
        variant: 'danger',
        durationMs: 5000,
      })
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-surface px-4 py-3">
      <p className="text-sm font-medium text-text-primary">Forgot a set on {dayLabel}?</p>
      <p className="mt-0.5 text-xs text-text-muted">
        Add it here. You can log and edit today and yesterday only.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Reps"
          aria-label={`Reps to add to ${dayLabel}`}
          className={cn(
            'w-24 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary',
            'outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/30',
          )}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleAdd()
            }
          }}
        />
        <Button
          variant="secondary"
          className="min-h-10 px-4 text-sm"
          disabled={!isValid}
          loading={bankPushups.isPending}
          onClick={() => void handleAdd()}
        >
          Add set
        </Button>
      </div>
    </div>
  )
}
