import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ButtonRouterLink, Card, useToast } from '@/components/ui'
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
  guestDayTotal,
  guestEntriesForDay,
  localDateKey,
  readGuestLog,
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

  const today = localDateKey()
  const todayTotal = useMemo(() => guestDayTotal(entries, today), [entries, today])
  const todaySets = useMemo(() => guestEntriesForDay(entries, today), [entries, today])

  function handleBank() {
    const count = loggerRef.current?.getCount() ?? 0
    if (count <= 0) return

    addGuestEntry(count)
    setEntries(readGuestLog())
    loggerRef.current?.unwind()
    successHaptic()
    toast({
      message: `${count} banked — saved on this device.`,
      variant: 'success',
      durationMs: 4000,
    })
  }

  function handleDelete(id: string) {
    setEntries(removeGuestEntry(id))
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between pb-3">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-text-primary">
          Push<span className="text-accent">·</span>US
        </p>
        <span className="rounded-[var(--radius-full)] border border-border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-text-muted">
          Guest
        </span>
      </header>

      {/* Persistent "you're not signed in" reminder */}
      <Card padding="md" className="space-y-2 border-accent/40 bg-accent-muted">
        <p className="text-sm font-semibold text-text-primary">You&apos;re just trying it out 👋</p>
        <p className="text-xs leading-relaxed text-text-muted">
          Reps you log here are saved on <span className="font-medium text-text-primary">this
          device only</span>. They&apos;ll disappear if you clear your browser, use a different
          phone, or reinstall. Make a free account to keep your progress and push with your mates.
        </p>
        <div className="flex gap-2 pt-1">
          <Button className="min-h-10 flex-1 text-sm" onClick={() => navigate('/login')}>
            Create free account
          </Button>
          <ButtonRouterLink to="/login" variant="secondary" className="min-h-10 flex-1 text-sm">
            Sign in
          </ButtonRouterLink>
        </div>
      </Card>

      <div className="mt-3 flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2.5">
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-text-muted">
            Today
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-text-primary">
            {todayTotal}
            <span className="ml-1.5 text-sm font-medium text-text-muted">reps</span>
          </p>
        </div>
        <p className="text-xs text-text-muted">
          {todaySets.length} set{todaySets.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-3">
        <CircularLogger
          ref={loggerRef}
          onCanBankChange={setCanBank}
          showDragHint={entries.length === 0}
        />

        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            tapHaptic()
            loggerRef.current?.addReps(10)
          }}
          aria-label="Add 10 reps"
          className="mt-3 min-h-11 px-10"
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
                    className="text-xs text-text-muted transition-colors hover:text-danger"
                    onClick={() => handleDelete(entry.id)}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="pt-1 text-center text-[0.65rem] text-text-muted">
        {appConfig.name} — guest mode. Nothing here is shared or synced.
      </p>
    </div>
  )
}
