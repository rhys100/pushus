import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActivityIcon } from '@/components/ui/ActivityIcon'
import { Button } from '@/components/ui/Button'
import { getLastSeenNewsId, setLastSeenNewsId } from '@/lib/storage'
import {
  latestNewsId,
  NEWS_ITEMS,
  unseenNewsItems,
  WHATS_NEW_SIGNOFF,
  type NewsItem,
} from '@/lib/whatsNew'
import { useAuth } from '@/providers/AuthProvider'

/**
 * One-time "What's new" modal for returning members. Shows every launch note
 * they haven't seen, then remembers the newest id per device. Members who
 * joined after a launch never see that item.
 */
export function WhatsNewPopup() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<NewsItem[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user?.id || !profile) {
      return
    }

    const lastSeen = getLastSeenNewsId(user.id)
    const unseen = unseenNewsItems(NEWS_ITEMS, lastSeen, profile.created_at)

    if (unseen.length > 0) {
      setItems(unseen)
      setOpen(true)
    } else if (lastSeen == null) {
      // Nothing is news to this member (joined after launch) — settle the
      // marker so future comparisons start from here.
      const latest = latestNewsId()

      if (latest) {
        setLastSeenNewsId(user.id, latest)
      }
    }
  }, [profile, user?.id])

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismiss()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id])

  function dismiss() {
    const latest = latestNewsId()

    if (user?.id && latest) {
      setLastSeenNewsId(user.id, latest)
    }

    setOpen(false)
  }

  if (!open || items.length === 0) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="What's new in PushUS"
      data-testid="whats-new-popup"
    >
      <button
        type="button"
        aria-label="Dismiss what's new"
        className="absolute inset-0 bg-black/60"
        onClick={dismiss}
      />
      <div
        className={
          'relative w-full max-w-sm rounded-[var(--radius-lg)] border-2 border-border bg-surface p-5 ' +
          'shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_48px_rgba(0,0,0,0.6)]'
        }
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          What&apos;s new
        </p>
        <h2 className="mt-1 text-lg font-bold text-text-primary">
          Fresh out of the gym 🎉
        </h2>

        <ul className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-bg text-accent">
                <ActivityIcon icon={item.emoji} className="h-4 w-4 text-base" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-right text-xs font-medium italic text-text-muted">
          {WHATS_NEW_SIGNOFF}
        </p>

        <Button fullWidth className="mt-3" onClick={dismiss}>
          Got it
        </Button>

        <Button
          variant="ghost"
          fullWidth
          className="mt-1 min-h-9 text-xs text-text-muted"
          onClick={() => {
            dismiss()
            navigate('/settings/whats-new')
          }}
        >
          See past updates
        </Button>
      </div>
    </div>
  )
}
