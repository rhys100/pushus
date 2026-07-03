import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { noticeSurfaceClass } from '@/lib/noticeStyles'

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
    <Card padding="sm" className={cn('mt-3', noticeSurfaceClass.accent)}>
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
          className="min-h-9 flex-1 px-3 text-sm"
          onClick={onTryMaxSet}
        >
          {maxSetModeActive ? 'Max set mode on' : 'Try max set'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-9 flex-1 px-3 text-sm"
          onClick={onStickToPlan}
        >
          Stick to plan
        </Button>
      </div>
    </Card>
  )
}
