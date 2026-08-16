import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { usePresence } from '@/hooks/usePresence'
import { Button } from '@/components/ui/Button'
import { shareOrDownloadFile } from '@/lib/downloadFile'
import { svgToPngBlob } from '@/lib/svgToPng'
import {
  buildPrCardSvg,
  prCardFilename,
  prShareText,
  PR_CARD_HEIGHT,
  PR_CARD_WIDTH,
} from '@/lib/prCardSvg'

export type PrShareCardProps = {
  open: boolean
  count: number
  previousBest: number
  displayName: string
  onDismiss: () => void
  className?: string
}

/**
 * Celebrates a new biggest set and offers a shareable image.
 *
 * The PNG is rendered as soon as the card opens, not when Share is tapped:
 * iOS requires navigator.share to be called inside the gesture that triggered
 * it, and awaiting rasterisation first spends the user activation, after which
 * the share sheet silently never appears.
 */
export function PrShareCard({
  open,
  count,
  previousBest,
  displayName,
  onDismiss,
  className,
}: PrShareCardProps) {
  const { mounted, closing } = usePresence(open)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [failed, setFailed] = useState(false)
  const [sharing, setSharing] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    setFailed(false)

    void svgToPngBlob(
      buildPrCardSvg({ count, previousBest, displayName }),
      PR_CARD_WIDTH,
      PR_CARD_HEIGHT,
    )
      .then((rendered) => {
        if (!cancelled) setBlob(rendered)
      })
      .catch(() => {
        // The celebration still stands without a shareable image.
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [open, count, previousBest, displayName])

  useEffect(() => {
    if (!open) {
      return
    }

    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismissRef.current()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [open])

  if (!mounted) {
    return null
  }

  const gain = Math.max(0, count - previousBest)

  async function handleShare() {
    if (!blob) return

    setSharing(true)
    try {
      await shareOrDownloadFile({
        blob,
        filename: prCardFilename(count),
        title: 'New personal record',
        text: prShareText(count),
      })
    } finally {
      setSharing(false)
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={cn(
        'fixed inset-x-0 z-[45] outline-none',
        'bottom-[var(--bottom-nav-height)]',
        closing ? 'sheet-out' : 'sheet-in',
        className,
      )}
      role="dialog"
      aria-label="New personal record"
      aria-modal="true"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <p className="text-sm font-semibold text-text-primary">
          <span aria-hidden="true">🏆</span> New personal record — {count} in one set
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {gain > 0
            ? `${gain} more than your old best of ${previousBest}.`
            : `Matching your best of ${previousBest}.`}
        </p>

        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            className="min-h-11 flex-1 text-sm"
            disabled={!blob || sharing}
            loading={sharing}
            onClick={() => void handleShare()}
          >
            {failed ? 'Card unavailable' : 'Share it'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 shrink-0 px-4 text-sm"
            onClick={onDismiss}
          >
            Nice
          </Button>
        </div>
      </div>
    </div>
  )
}
