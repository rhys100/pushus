import { useRef, useState } from 'react'
import {
  CircularLogger,
  type CircularLoggerHandle,
} from '@/components/logger/CircularLogger'
import { BankPushupsButton } from '@/components/logger/BankPushupsButton'
import { NoseHoldHint } from '@/components/logger/NoseHoldHint'
import { NoseTapMode } from '@/components/logger/NoseTapMode'
import { DayProgressCard } from '@/components/today/DayProgressCard'
import { ProgressChart } from '@/components/progress/ProgressChart'
import { RepCalendar } from '@/components/feed/RepCalendar'
import { SetEffortSheet } from '@/components/logger/SetEffortSheet'
import { useFlipList } from '@/hooks/useFlipList'
import type { DayRepSummary } from '@/hooks/useRepHistory'
import { Button, GoalProgressBar, SegmentedControl, Skeleton, StatCard } from '@/components/ui'
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

const SAMPLE_CHART_LABELS = [
  '23/6', '24/6', '25/6', '26/6', '27/6', '28/6', '29/6',
  '30/6', '1/7', '2/7', '3/7', '4/7', '5/7', '6/7',
]

const SAMPLE_CHART_VALUES = [12, 20, 15, 28, 22, 35, 30, 42, 38, 36, 50, 45, 58, 64]
const SAMPLE_CHART_VALUES_B = [8, 14, 18, 16, 25, 24, 32, 30, 35, 40, 38, 47, 44, 52]

/**
 * Dev-only showcase of the core UI without auth or a backend.
 * Mounted at /dev/preview only when import.meta.env.DEV.
 */
export function DevPreviewPage() {
  const loggerRef = useRef<CircularLoggerHandle>(null)
  const [count, setCount] = useState(0)
  const [noseTapOpen, setNoseTapOpen] = useState(false)
  const [showNoseHint, setShowNoseHint] = useState(true)
  const [chartRun, setChartRun] = useState(0)
  const [sided, setSided] = useState<'single' | 'sided'>('single')
  const [barValue, setBarValue] = useState(18)

  const chartSeries =
    sided === 'sided'
      ? [
          { name: 'Left', color: 'var(--color-accent)', values: SAMPLE_CHART_VALUES },
          { name: 'Right', color: '#5aa9ff', values: SAMPLE_CHART_VALUES_B },
        ]
      : [{ name: 'Total reps', color: 'var(--color-accent)', values: SAMPLE_CHART_VALUES }]

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

      {/* Motion showcase: replay the chart draw, poke the bar, feel the pops */}
      <section
        aria-label="Motion showcase"
        className="mb-6 space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Motion showcase</h2>
          <Button
            variant="secondary"
            className="min-h-9 px-4 py-1.5 text-xs"
            onClick={() => setChartRun((run) => run + 1)}
          >
            Replay draw
          </Button>
        </div>

        <SegmentedControl
          options={[
            { value: 'single', label: 'One line' },
            { value: 'sided', label: 'Left / Right' },
          ]}
          value={sided}
          onChange={setSided}
          ariaLabel="Chart series mode"
        />

        <ProgressChart
          key={chartRun}
          series={chartSeries}
          labels={SAMPLE_CHART_LABELS}
          ariaLabel="Sample progression chart"
        />

        <div className="space-y-2">
          <GoalProgressBar current={barValue} target={45} showLabel />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="min-h-9 flex-1 px-3 py-1.5 text-xs"
              onClick={() => setBarValue((value) => Math.min(45, value + 9))}
            >
              +9 reps
            </Button>
            <Button
              variant="ghost"
              className="min-h-9 flex-1 px-3 py-1.5 text-xs"
              onClick={() => setBarValue(18)}
            >
              Reset
            </Button>
          </div>
          {/* Bound to the same +9 button: crossing 45 fires the celebration */}
          <DayProgressCard
            variant="compact"
            className="w-full"
            bankedToday={barValue}
            banksLogged={1}
            hasPlan
            dailyTarget={45}
            todayPrescription={SAMPLE_PRESCRIPTION}
          />
        </div>

        <FlipListDemo />

        <SheetDemo />

        <CalendarDemo />

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="This week" value={barValue * 7} hint="+12% vs last" trend="up" />
          <StatCard
            label="Streak"
            value={
              <>
                5
                <span className="flame-flicker" aria-hidden="true">
                  🔥
                </span>
              </>
            }
            hint="flame flickers when unbanked"
          />
        </div>

        <Skeleton className="h-10 w-full" />
      </section>

      <NoseHoldHint show={showNoseHint} onDismiss={() => setShowNoseHint(false)} />

      <NoseTapMode
        open={noseTapOpen}
        onBank={() => setNoseTapOpen(false)}
        onExit={() => setNoseTapOpen(false)}
      />
    </div>
  )
}

/** Slide-up sheet demo — same component the post-bank effort check uses. */
function SheetDemo() {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-muted">Bottom sheet</p>
        <Button
          variant="secondary"
          className="min-h-9 px-4 py-1.5 text-xs"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Close sheet' : 'Open sheet'}
        </Button>
      </div>
      <SetEffortSheet
        open={open}
        onSelect={() => setOpen(false)}
        onSkip={() => setOpen(false)}
      />
    </div>
  )
}

/** Month-cascade calendar demo with fabricated history. */
function CalendarDemo() {
  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const [monthStart, setMonthStart] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [selectedDate, setSelectedDate] = useState(todayKey)

  const summaries = new Map<string, DayRepSummary>()
  for (let dayOffset = 0; dayOffset < 40; dayOffset += 2) {
    const day = new Date(today)
    day.setDate(day.getDate() - dayOffset)
    const key = day.toISOString().slice(0, 10)
    summaries.set(key, { loggedFor: key, totalReps: 20 + ((dayOffset * 7) % 45), setCount: 2 })
  }

  return (
    <RepCalendar
      monthStart={monthStart}
      onMonthChange={setMonthStart}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      todayDate={todayKey}
      summariesByDate={summaries}
    />
  )
}

const FLIP_DEMO_NAMES = ['Rhys', 'Sam', 'Alex', 'Jordan', 'Casey']

/** Mini leaderboard proving the FLIP glide used on the real Board. */
function FlipListDemo() {
  const [order, setOrder] = useState(FLIP_DEMO_NAMES)
  const listRef = useFlipList<HTMLUListElement>(order)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-muted">Rank glide (FLIP)</p>
        <Button
          variant="secondary"
          className="min-h-9 px-4 py-1.5 text-xs"
          onClick={() =>
            setOrder((current) => [...current].sort(() => Math.random() - 0.5))
          }
        >
          Shuffle ranks
        </Button>
      </div>
      <ul
        ref={listRef}
        aria-label="FLIP demo list"
        className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-bg"
      >
        {order.map((name, index) => (
          <li
            key={name}
            data-flip-key={name}
            className="flex items-center gap-2 border-b border-border/25 bg-bg px-3 py-2 text-sm last:border-b-0"
          >
            <span className="font-mono text-xs text-text-muted">#{index + 1}</span>
            <span className="font-medium text-text-primary">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
