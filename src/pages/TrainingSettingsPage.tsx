import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge, Card, useToast } from '@/components/ui'
import { TrainingWizard } from '@/components/training/TrainingWizard'
import { SettingsLinkRow } from '@/components/settings/SettingsLinkRow'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'
import { useAuth } from '@/providers/AuthProvider'
import { useNotificationPreferences } from '@/providers/NotificationPreferencesProvider'
import { DRAFT_FORMULAS_ENABLED, type WizardAnswers } from '@/lib/training/planEngine'

export function TrainingSettingsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { activeGroup } = useActiveGroup()
  const { savePlan, saving, wizardCompleted, dailyTarget } = useTrainingPlan(
    user?.id,
    activeGroup?.id,
  )
  const { refresh: refreshNotificationPrefs } = useNotificationPreferences()

  async function handleComplete(answers: WizardAnswers) {
    try {
      const saved = await savePlan(answers)
      await refreshNotificationPrefs()
      toast({
        message: `Training plan saved — ${saved.estimated_capacity} push-ups per day.`,
        variant: 'success',
      })
      navigate('/settings')
    } catch (error) {
      toast({
        message: error instanceof Error ? error.message : 'Could not save training plan.',
        variant: 'danger',
      })
    }
  }

  return (
    <AppLayout title="Training plan" subtitle="Personal targets" showNav>
      <div className="space-y-4 pb-8">
        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">Training wizard</p>
            <Badge variant={DRAFT_FORMULAS_ENABLED ? 'accent' : 'warning'}>
              {wizardCompleted ? 'Plan saved' : 'Not set up yet'}
            </Badge>
          </div>
          <p className="text-xs text-text-muted">
            Answer a few questions and we will recommend a daily push-up target. General fitness
            guidance only — not medical advice.
          </p>
        </Card>

        <TrainingWizard saving={saving} onComplete={(answers) => void handleComplete(answers)} />

        <Card padding="md">
          <SettingsLinkRow to="/settings" title="Back to settings" />
        </Card>
      </div>
    </AppLayout>
  )
}
