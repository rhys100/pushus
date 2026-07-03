import { useRef, useState } from 'react'
import {
  CircularLogger,
  type CircularLoggerHandle,
} from '@/components/logger/CircularLogger'
import { BankPushupsButton } from '@/components/logger/BankPushupsButton'
import { NoseTapMode } from '@/components/logger/NoseTapMode'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/**
 * Dev-only showcase of the core UI without auth or a backend.
 * Mounted at /dev/preview only when import.meta.env.DEV.
 */
export function DevPreviewPage() {
  const loggerRef = useRef<CircularLoggerHandle>(null)
  const [count, setCount] = useState(0)
  const [noseTapOpen, setNoseTapOpen] = useState(false)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-3 pt-8">
      <header className="flex items-center justify-between pb-4">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-text-primary">
          Push<span className="text-accent">·</span>Up Log
        </p>
        <span className="text-xs text-text-muted">dev preview</span>
      </header>

      <BankPushupsButton
        placement="inline"
        disabled={count === 0}
        onBank={() => loggerRef.current?.unwind()}
      />

      <div className="flex flex-1 flex-col items-center justify-center py-4">
        <CircularLogger ref={loggerRef} onCountChange={setCount} showDragHint />
      </div>

      <div className="flex flex-col items-center gap-3 pb-4">
        <Button type="button" fullWidth onClick={() => setNoseTapOpen(true)}>
          👃 Nose/chin reps
        </Button>

        <Card className="w-full">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-accent">4</p>
              <p className="text-xs uppercase tracking-wide text-text-muted">Sets today</p>
            </div>
            <div>
              <p className="text-lg font-bold text-accent">25</p>
              <p className="text-xs uppercase tracking-wide text-text-muted">Best set</p>
            </div>
            <div>
              <p className="text-lg font-bold text-accent">63%</p>
              <p className="text-xs uppercase tracking-wide text-text-muted">Goal</p>
            </div>
          </div>
        </Card>
      </div>

      <NoseTapMode
        open={noseTapOpen}
        onBank={() => setNoseTapOpen(false)}
        onExit={() => setNoseTapOpen(false)}
      />
    </div>
  )
}
