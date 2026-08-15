import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import { noticeInlineClass } from '@/lib/noticeStyles'
import { useWorkoutExport } from '@/hooks/useWorkoutExport'
import { useAuth } from '@/providers/AuthProvider'
import { useGroup } from '@/providers/GroupProvider'

/**
 * Download every set you have logged as a CSV.
 *
 * Deliberately scoped and worded as a workout export, not a full
 * subject-access export — it covers logged sets across every group you are in,
 * and says so, rather than implying it contains everything PushUS holds.
 */
export function DataExportSettings() {
  const { user, profile } = useAuth()
  const { groups } = useGroup()
  const timezone = profile?.timezone || 'UTC'
  const { exporting, error, lastOutcome, rowCount, runExport } = useWorkoutExport(
    user?.id,
    groups,
    timezone,
  )

  const groupLabel =
    groups.length === 0
      ? 'your groups'
      : groups.length === 1
        ? groups[0].name
        : `${groups.length} groups`

  return (
    <Card padding="md" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Export your log</h3>
        <p className="mt-1 text-xs text-text-muted">
          Every push-up set and custom activity you have logged in {groupLabel}, as a CSV you
          can open in any spreadsheet. Dates use each group&apos;s timezone, so they match what
          you saw when you banked them.
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        fullWidth
        disabled={exporting || !user}
        loading={exporting}
        onClick={() => void runExport()}
        className="min-h-11"
      >
        {exporting ? 'Preparing…' : 'Download CSV'}
      </Button>

      {error ? (
        <p className={cn(noticeInlineClass('danger'), 'text-text-muted')} role="alert">
          {error}
        </p>
      ) : null}

      {lastOutcome && !error ? (
        <p className={cn(noticeInlineClass('success'), 'text-text-muted')} role="status">
          {lastOutcome === 'cancelled'
            ? 'Export cancelled.'
            : `${rowCount ?? 0} ${rowCount === 1 ? 'set' : 'sets'} exported.`}
        </p>
      ) : null}
    </Card>
  )
}
