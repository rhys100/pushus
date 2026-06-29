import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export type ChallengeMaxCheckInCardProps = {
  onTryMaxSet: () => void
  onStickToPlan: () => void
  maxSetModeActive?: boolean
}

export function ChallengeMaxCheckInCard({
  onTryMaxSet,
  onStickToPlan,
  maxSetModeActive = false,
}: ChallengeMaxCheckInCardProps) {
  return (
    <Card padding="sm" className="mt-3 border-accent/30 bg-accent-muted/20">
      <p className="text-sm font-medium text-text-primary">
        Feeling good? Try a clean max set today.
      </p>
      <p className="mt-1 text-xs text-text-muted">
        Not today? Just do the planned sets. Stop when form breaks.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={maxSetModeActive ? 'primary' : 'secondary'}
          size="sm"
          className="flex-1"
          onClick={onTryMaxSet}
        >
          {maxSetModeActive ? 'Max set mode on' : 'Try max set'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={onStickToPlan}>
          Stick to plan
        </Button>
      </div>
    </Card>
  )
}
