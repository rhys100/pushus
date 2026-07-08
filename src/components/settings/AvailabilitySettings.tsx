import { useQuery } from '@tanstack/react-query'
import { Button, Card, Skeleton, useToast } from '@/components/ui'
import { getErrorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import {
  useEndInjury,
  useMyAvailability,
  useResumeFullPlan,
  useSetAvailability,
  type MemberAvailability,
} from '@/hooks/useAvailability'
import { useAuth } from '@/providers/AuthProvider'

const STATUS_LABEL: Record<MemberAvailability, string> = {
  active: 'Training',
  injured: 'Injured',
  sub_out: 'Subbing out',
}

// Lightweight read of the active plan's ramp-back flag — lets the card offer
// "resume full" even after the injury episode itself has ended.
function usePlanIsRampBack(): boolean {
  const { user } = useAuth()
  const { activeGroup } = useActiveGroup()
  const { data } = useQuery({
    queryKey: ['training-plan', user?.id, activeGroup?.id, 'ramp-flag'],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('user_training_plans')
        .select('plan_status')
        .eq('user_id', user!.id)
        .eq('group_id', activeGroup!.id)
        .maybeSingle()
      if (error) throw error
      return data?.plan_status === 'ramp_back'
    },
    enabled: Boolean(user?.id && activeGroup?.id),
    staleTime: 60_000,
  })
  return data ?? false
}

/**
 * Group-visible availability. Going injured / sub-out pauses reminders and the
 * training plan and protects the streak (locked injury rules). Returning offers
 * an eased ramp-back. No medical details are collected. `onChanged` lets the
 * host refresh reminder prefs, which live outside react-query.
 */
export function AvailabilitySettings({ onChanged }: { onChanged?: () => void }) {
  const { toast } = useToast()
  const { data: availability, isLoading } = useMyAvailability()
  const isRampBack = usePlanIsRampBack()
  const setAvailability = useSetAvailability()
  const endInjury = useEndInjury()
  const resumeFull = useResumeFullPlan()

  const status = availability?.status ?? 'active'
  const isAway = status === 'injured' || status === 'sub_out'
  const busy = setAvailability.isPending || endInjury.isPending || resumeFull.isPending

  async function goAway(next: 'injured' | 'sub_out') {
    try {
      await setAvailability.mutateAsync({ status: next })
      onChanged?.()
      toast({
        message:
          next === 'injured'
            ? 'Marked injured. Reminders and your plan are paused, streak protected.'
            : 'Subbing out. Your group can see you’re away.',
        variant: 'success',
      })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not update status.'), variant: 'danger' })
    }
  }

  async function comeBack(ramp: boolean) {
    try {
      await endInjury.mutateAsync(ramp)
      onChanged?.()
      toast({
        message: ramp
          ? 'Welcome back — eased ramp-back targets for now.'
          : 'Back to full training.',
        variant: 'success',
      })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not update status.'), variant: 'danger' })
    }
  }

  async function resumeFullPlan() {
    try {
      await resumeFull.mutateAsync()
      onChanged?.()
      toast({ message: 'Full training targets resumed.', variant: 'success' })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not resume plan.'), variant: 'danger' })
    }
  }

  return (
    <Card padding="md" className="space-y-3">
      <div>
        <p className="text-sm font-medium text-text-primary">Availability</p>
        <p className="mt-1 text-xs text-text-muted">
          {isAway
            ? `You're set to ${STATUS_LABEL[status]}. Your group can see it; reminders and plan progression are paused and your streak is protected.`
            : 'Injured or taking a break? Pause reminders and your plan without breaking your streak.'}
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-11 w-full" />
      ) : isAway ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              className="min-h-10 flex-1 text-sm"
              loading={endInjury.isPending}
              disabled={busy}
              onClick={() => void comeBack(true)}
            >
              I&apos;m back (ease in)
            </Button>
            <Button
              variant="secondary"
              className="min-h-10 flex-1 text-sm"
              disabled={busy}
              onClick={() => void comeBack(false)}
            >
              Back at full
            </Button>
          </div>
          {status === 'injured' ? (
            <Button
              variant="ghost"
              className="min-h-9 w-full text-sm"
              disabled={busy}
              onClick={() => void goAway('sub_out')}
            >
              Change to subbing out
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="min-h-9 w-full text-sm"
              disabled={busy}
              onClick={() => void goAway('injured')}
            >
              Change to injured
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="min-h-10 text-sm"
            disabled={busy}
            onClick={() => void goAway('injured')}
          >
            🤕 Injured
          </Button>
          <Button
            variant="secondary"
            className="min-h-10 text-sm"
            disabled={busy}
            onClick={() => void goAway('sub_out')}
          >
            ⏸️ Sub out
          </Button>
        </div>
      )}

      {isRampBack && !isAway ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-accent/40 bg-accent-muted px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-text-primary">Ramp-back mode</p>
            <p className="text-xs text-text-muted">Targets eased ~30% while you rebuild.</p>
          </div>
          <Button
            variant="secondary"
            className="min-h-9 shrink-0 px-3 text-sm"
            loading={resumeFull.isPending}
            disabled={busy}
            onClick={() => void resumeFullPlan()}
          >
            Resume full
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
