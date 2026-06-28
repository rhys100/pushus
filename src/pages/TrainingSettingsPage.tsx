import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge, Card, useToast } from '@/components/ui'
import { TrainingWizard } from '@/components/training/TrainingWizard'
import { SettingsLinkRow } from '@/components/settings/SettingsLinkRow'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'
import { useAuth } from '@/providers/AuthProvider'
import { type WizardAnswers } from '@/lib/training/planEngine'
import { getErrorMessage } from '@/lib/errors'

export function TrainingSettingsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { activeGroup } = useActiveGroup()
  const { savePlan, saving, wizardCompleted, savedWizardAnswers } = useTrainingPlan(
    user?.id,
    activeGroup?.id,
    activeGroup?.timezone,
  )

  async function handleComplete(answers: WizardAnswers) {
    try {
      const saved = await savePlan(answers)
      toast({
        message: `Training plan saved — peak day ${saved.estimated_capacity} reps. Your 4-week build starts now.`,
        variant: 'success',
      })
      navigate('/settings')
    } catch (error) {
      toast({
        message: getErrorMessage(error, 'Could not save training plan.'),
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
            <Badge variant={wizardCompleted ? 'success' : 'warning'}>
              {wizardCompleted ? 'Plan saved' : 'Not set up yet'}
            </Badge>
          </div>
          <p className="text-xs text-text-muted">
            Answer a few questions and we will build a 4-week plan with rest, easy, moderate, and
            challenge days. General fitness guidance only — not medical advice.
          </p>
        </Card>

        <TrainingWizard
          saving={saving}
          initialAnswers={savedWizardAnswers}
          onComplete={(answers) => void handleComplete(answers)}
        />

        <Card padding="md">
          <SettingsLinkRow to="/settings" title="Back to settings" />
        </Card>
      </div>
    </AppLayout>
  )
}
