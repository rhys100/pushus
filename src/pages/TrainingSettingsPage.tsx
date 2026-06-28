import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Badge, Card } from '@/components/ui'
import { TrainingWizard } from '@/components/training/TrainingWizard'
import { DRAFT_FORMULAS_ENABLED } from '@/lib/training/planEngine'

export function TrainingSettingsPage() {
  return (
    <AppLayout title="Training plan" subtitle="Personal targets" showNav={false}>
      <div className="space-y-4 pb-8">
        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">Training wizard</p>
            <Badge variant={DRAFT_FORMULAS_ENABLED ? 'accent' : 'warning'}>
              {DRAFT_FORMULAS_ENABLED ? 'Draft formulas on' : 'Conservative defaults'}
            </Badge>
          </div>
          <p className="text-xs text-text-muted">
            Complete the wizard to set daily targets. Draft progression formulas are marked for
            review and stay off until explicitly enabled.
          </p>
        </Card>

        <TrainingWizard />

        <Card padding="md">
          <Link
            to="/settings"
            className="flex min-h-11 items-center justify-between text-sm text-text-primary hover:text-accent"
          >
            Back to settings
            <span aria-hidden="true">→</span>
          </Link>
        </Card>
      </div>
    </AppLayout>
  )
}
