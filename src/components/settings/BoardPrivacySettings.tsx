import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, useToast } from '@/components/ui'
import { leaderboardKeys } from '@/hooks/useLeaderboard'
import { getErrorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'

/**
 * Board privacy: by default other members only see % of your daily goal on the
 * day board. Opting in shows them your raw rep totals instead.
 */
export function BoardPrivacySettings() {
  const { user, profile, refreshProfile } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  if (!user || !profile) {
    return null
  }

  async function handleToggle(checked: boolean) {
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({ show_rep_totals: checked })
      .eq('id', user!.id)

    setSaving(false)

    if (error) {
      toast({
        message: getErrorMessage(error, 'Could not update board privacy.'),
        variant: 'danger',
      })
      return
    }

    await refreshProfile()
    void queryClient.invalidateQueries({ queryKey: leaderboardKeys.all })
    toast({
      message: checked
        ? 'Your rep totals now show on the day board.'
        : 'Back to showing % on the day board.',
      variant: 'success',
    })
  }

  return (
    <Card padding="md" className="space-y-3">
      <div>
        <p className="text-sm font-medium text-text-primary">Board privacy</p>
        <p className="mt-1 text-xs text-text-muted">
          Weekly and monthly boards always show rep totals. On the day board, others see
          % of your goal unless you opt in to showing the real numbers.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          checked={profile.show_rep_totals ?? false}
          disabled={saving}
          onChange={(event) => void handleToggle(event.target.checked)}
        />
        <span>
          <span className="block text-sm text-text-primary">
            Show my rep totals on the day board
          </span>
          <span className="block text-xs text-text-muted">
            Group mates see your actual reps instead of a percentage.
          </span>
        </span>
      </label>
    </Card>
  )
}
