import { useRef, useState } from 'react'
import {
  CircularLogger,
  type CircularLoggerHandle,
} from '@/components/logger/CircularLogger'
import { BankPushupsButton } from '@/components/logger/BankPushupsButton'
import { NoseHoldHint } from '@/components/logger/NoseHoldHint'
import { NoseTapMode } from '@/components/logger/NoseTapMode'
import { DayProgressCard } from '@/components/today/DayProgressCard'
import type { TodayPrescription } from '@/lib/training/planEngine'

const SAMPLE_PRESCRIPTION: TodayPrescription = {
  dayType: 'moderate',
  target: 45,
  setSize: 15,
  sets: 3,
  label: 'Moderate — 3 sets of 15',
  isRestDay: false,
  mesocycleWeek: 2,
  suggestMaxCheckIn: false,
  safetyNote: null,
  dayTypeLabel: 'Moderate',
}

/**
 * Dev-only showcase of the core UI without auth or a backend.
 * Mounted at /dev/preview only when import.meta.env.DEV.
 */
export function DevPreviewPage() {
  const loggerRef = useRef<CircularLoggerHandle>(null)
  const [count, setCount] = useState(0)
  const [noseTapOpen, setNoseTapOpen] = useState(false)
  const [showNoseHint, setShowNoseHint] = useState(true)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-3 pt-8">
      <header className="flex items-center justify-between pb-4">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-text-primary">
          Push<span className="text-accent">·</span>Up Log
        </p>
        <span className="text-xs text-text-muted">dev preview</span>
      </header>

      <DayProgressCard
        variant="compact"
        className="w-full"
        bankedToday={count}
        banksLogged={count > 0 ? 1 : 0}
        hasPlan
        dailyTarget={SAMPLE_PRESCRIPTION.target}
        todayPrescription={SAMPLE_PRESCRIPTION}
      />

      <div className="flex flex-1 flex-col items-center justify-center py-4">
        <CircularLogger
          ref={loggerRef}
          onCountChange={setCount}
          onLongPressCenter={() => setNoseTapOpen(true)}
          showDragHint
        />

        <BankPushupsButton
          placement="inline"
          disabled={count === 0}
          onBank={() => loggerRef.current?.unwind()}
          className="mt-5"
        />
      </div>

      <NoseHoldHint show={showNoseHint} onDismiss={() => setShowNoseHint(false)} />

      <NoseTapMode
        open={noseTapOpen}
        onBank={() => setNoseTapOpen(false)}
        onExit={() => setNoseTapOpen(false)}
      />
    </div>
  )
}
