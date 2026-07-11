import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  CircularLogger,
  type CircularLoggerHandle,
} from '@/components/logger/CircularLogger'
import { BankPushupsButton } from '@/components/logger/BankPushupsButton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { successHaptic, tapHaptic } from '@/lib/haptics'
import { appConfig } from '@/lib/config'
import {
  addGuestEntry,
  dismissGuestWarning,
  guestAllTimeTotal,
  guestDayTotal,
  guestEntriesForDay,
  isGuestWarningDismissed,
  localDateKey,
  markMilestoneShown,
  milestoneToCelebrate,
  readGuestLog,
  readShownMilestones,
  removeGuestEntry,
  type GuestEntry,
} from '@/lib/guestLog'

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function GuestPage() {
  useDocumentTitle('Try it — guest mode')
  const navigate = useNavigate()
  const { toast } = useToast()
  const loggerRef = useRef<CircularLoggerHandle>(null)
  const [entries, setEntries] = useState<GuestEntry[]>(readGuestLog)
  const [canBank, setCanBank] = useState(false)
  const [warningHidden, setWarningHidden] = useState(isGuestWarningDismissed)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Match the app-wide confirm-before-delete pattern — arm for 4s, then a
  // second tap removes. Guest reps are device-only, so a fat-finger tap on
  // Delete shouldn't silently lose a set with no undo.
  useEffect(() => {
    if (!confirmDeleteId) {
      return
    }
    const timer = window.setTimeout(() => setConfirmDeleteId(null), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmDeleteId])

  function handleDismissWarning() {
    dismissGuestWarning()
    setWarningHidden(true)
  }

  const today = localDateKey()
  const todayTotal = useMemo(() => guestDayTotal(entries, today), [entries, today])
  const todaySets = useMemo(() => guestEntriesForDay(entries, today), [entries, today])

  function handleBank() {
    const count = loggerRef.current?.getCount() ?? 0
    if (count <= 0) return

    const prevTotal = guestAllTimeTotal(entries)
    addGuestEntry(count)
    const next = readGuestLog()
    setEntries(next)
    loggerRef.current?.unwind()
    successHaptic()

    // Celebrate the reps they've sunk in — the best moment to nudge sign-up.
    const milestone = milestoneToCelebrate(prevTotal, guestAllTimeTotal(next), readShownMilestones())
    if (milestone) {
      markMilestoneShown(milestone)
      toast({
        message: `💪 ${milestone} reps as a guest — nice! Save them before you lose them.`,
        variant: 'success',
        durationMs: 9000,
        actionLabel: 'Sign up',
        onAction: () => navigate('/login'),
      })
      return
    }

    toast({
      message: `${count} banked — saved on this device.`,
      variant: 'success',
      durationMs: 4000,
    })
  }

  function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    setConfirmDeleteId(null)
    setEntries(removeGuestEntry(id))
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3 pb-2">
        <p className="flex items-baseline text-sm font-bold uppercase tracking-[0.25em] text-text-primary">
          <span aria-hidden="true" className="mr-1 text-accent">·</span>
          {appConfig.name}
        </p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-text-muted">
            <span className="font-bold text-text-primary">{todayTotal}</span> today ·{' '}
            {todaySets.length} set{todaySets.length === 1 ? '' : 's'}
          </span>
          <span className="rounded-[var(--radius-full)] border border-border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-text-muted">
            Guest
          </span>
        </div>
      </header>

      {/* Slim, dismissible warning — the account CTAs live at the bottom so the
          ring stays in the natural thumb zone (same as the real Log screen). */}
      {!warningHidden ? (
        <div className="mb-1 flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-3 py-2">
          <span aria-hidden="true" className="text-sm leading-tight">
            ⚠️
          </span>
          <p className="flex-1 text-xs leading-snug text-text-muted">
            Guest mode — reps save on this device only and can be lost. Create an account below to
            keep them.
          </p>
          <button
            type="button"
            aria-label="Dismiss guest warning"
            onClick={handleDismissWarning}
            className="-my-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-lg leading-none text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center justify-center py-2">
        {/* Negative bottom margin absorbs the ring SVG's internal whitespace so
            +10 hugs the ring — matches the tightened Log screen layout. */}
        <CircularLogger
          ref={loggerRef}
          onCanBankChange={setCanBank}
          showDragHint={entries.length === 0}
          className="px-0 py-0 -mb-5"
        />

        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            tapHaptic()
            loggerRef.current?.addReps(10)
          }}
          aria-label="Add 10 reps"
          className="mt-2 min-h-11 px-10"
        >
          +10
        </Button>

        <BankPushupsButton
          placement="inline"
          disabled={!canBank}
          onBank={handleBank}
          className="mt-3"
        />
      </div>

      {todaySets.length > 0 ? (
        <section className="space-y-1.5 pb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Today&apos;s sets
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
            {todaySets.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {entry.count} reps
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">{formatTime(entry.ts)}</span>
                  <button
                    type="button"
                    aria-label={
                      confirmDeleteId === entry.id ? 'Confirm delete set' : 'Delete set'
                    }
                    className={cn(
                      'rounded-[var(--radius-sm)] px-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                      confirmDeleteId === entry.id
                        ? 'font-semibold text-danger'
                        : 'text-text-muted hover:text-danger',
                    )}
                    onClick={() => handleDelete(entry.id)}
                  >
                    {confirmDeleteId === entry.id ? 'Confirm?' : 'Delete'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Account CTAs pinned to the bottom, out of the ring's thumb zone. */}
      <div className="mt-2 space-y-2 border-t border-border pt-3">
        <p className="text-center text-xs text-text-muted">
          {entries.length > 0
            ? 'Keep these reps and push with your mates.'
            : `${appConfig.name} — nothing here is shared or synced.`}
        </p>
        {/* One CTA: /login is a single passwordless screen that handles both new
            and returning users, so two buttons here would do exactly the same thing. */}
        <Button
          fullWidth
          className="min-h-11 text-sm"
          onClick={() => navigate('/login')}
        >
          Create free account or sign in
        </Button>
      </div>
    </div>
  )
}
