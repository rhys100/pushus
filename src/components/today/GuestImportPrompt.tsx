import { useState } from 'react'
import { Button, Card, useToast } from '@/components/ui'
import { getErrorMessage } from '@/lib/errors'
import {
  dismissGuestImport,
  guestAllTimeTotal,
  isGuestImportDismissed,
  readGuestLog,
} from '@/lib/guestLog'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useImportGuestReps } from '@/hooks/useGuestImport'

/**
 * One-time welcome prompt: if this device has guest reps (played before signing
 * up), offer to carry them into the member's group so the effort isn't lost.
 * Renders nothing when there's no guest data, it was declined, or no group yet.
 */
export function GuestImportPrompt() {
  const { toast } = useToast()
  const { activeGroup } = useActiveGroup()
  const importReps = useImportGuestReps()
  const [entries] = useState(readGuestLog)
  const [hidden, setHidden] = useState(false)

  if (hidden || isGuestImportDismissed() || entries.length === 0 || !activeGroup) {
    return null
  }

  const total = guestAllTimeTotal(entries)

  async function handleImport() {
    if (!activeGroup) return
    try {
      const result = await importReps.mutateAsync(activeGroup.id)
      setHidden(true)
      toast({
        message: `Imported ${result.total} guest rep${result.total === 1 ? '' : 's'} into ${activeGroup.name} 💪`,
        variant: 'success',
        durationMs: 6000,
      })
    } catch (error) {
      toast({ message: getErrorMessage(error, 'Could not import your reps.'), variant: 'danger' })
    }
  }

  function handleDismiss() {
    dismissGuestImport()
    setHidden(true)
  }

  return (
    <Card padding="md" className="mb-3 space-y-2 border-accent/40 bg-accent-muted">
      <p className="text-sm font-semibold text-text-primary">
        Welcome! You banked {total} rep{total === 1 ? '' : 's'} as a guest 🎉
      </p>
      <p className="text-xs text-text-muted">
        Want to add them to <span className="font-medium text-text-primary">{activeGroup.name}</span>{' '}
        so they count toward your history and streak?
      </p>
      <div className="flex gap-2 pt-1">
        <Button
          className="min-h-10 flex-1 text-sm"
          loading={importReps.isPending}
          onClick={() => void handleImport()}
        >
          Add my reps
        </Button>
        <Button
          variant="secondary"
          className="min-h-10 flex-1 text-sm"
          disabled={importReps.isPending}
          onClick={handleDismiss}
        >
          No thanks
        </Button>
      </div>
    </Card>
  )
}
