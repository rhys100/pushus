import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge, Card, useToast } from '@/components/ui'
import { TrainingWizard } from '@/components/training/TrainingWizard'
import { SettingsLinkRow } from '@/components/settings/SettingsLinkRow'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useTrainingPlan, useTrainingHistoryStats } from '@/hooks/useTrainingPlan'
import { useAuth } from '@/providers/AuthProvider'
import { type WizardAnswers } from '@/lib/training/planEngine'
import { getErrorMessage } from '@/lib/errors'

export function TrainingSettingsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { activeGroup } = useActiveGroup()
  const { savePlan, saving, wizardCompleted, savedWizardAnswers, progressionNote, loading: planLoading } =
    useTrainingPlan(user?.id, activeGroup?.id, activeGroup?.timezone)
  const { data: historyStats, isLoading: historyLoading } = useTrainingHistoryStats(
    user?.id,
    activeGroup?.id,
  )

  async function handleComplete(answers: WizardAnswers) {
    try {
      const saved = await savePlan(answers)
      navigate('/settings', {
        state: {
          planSaved: true,
          peakDay: saved.estimated_capacity,
        },
      })
    } catch (error) {
      toast({
        message: getErrorMessage(error, 'Could not save training plan.'),
        variant: 'danger',
      })
    }
  }

  return (
    <AppLayout title="Training plan" subtitle="Personal targets" showNav>
      <div className="space-y-4 pb-[calc(var(--bank-cta-height)+0.5rem)]">
        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">Training plan</p>
            <Badge variant={wizardCompleted ? 'success' : 'warning'}>
              {wizardCompleted ? 'Plan saved' : 'Not set up yet'}
            </Badge>
          </div>
          <p className="text-xs text-text-muted">
            Re-run anytime — your plan updates on save.
          </p>
          {progressionNote ? (
            <p className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-xs text-text-primary">
              {progressionNote}
            </p>
          ) : null}
        </Card>

        <TrainingWizard
          saving={saving}
          initialAnswers={savedWizardAnswers}
          savedAnswersReady={!planLoading}
          historyStats={historyStats ?? null}
          historyLoading={historyLoading}
          onComplete={(answers) => void handleComplete(answers)}
        />

        <Card padding="md">
          <SettingsLinkRow to="/settings" title="Back to settings" />
        </Card>
      </div>
    </AppLayout>
  )
}
