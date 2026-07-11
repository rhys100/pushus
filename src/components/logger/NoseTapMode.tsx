import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { playDink, playQuakeRumble, primeDinkAudio } from '@/lib/dinkSound'
import { isRepHapticSupported } from '@/lib/repHaptic'

export type NoseTapModeProps = {
  open: boolean
  banking?: boolean
  onBank: (count: number) => void
  onExit: () => void
}

export type NoseTapSkinId = 'bricks' | 'classic' | 'ripple' | 'burst'

const SKINS: { id: NoseTapSkinId; label: string }[] = [
  { id: 'bricks', label: '🧱 Bricks' },
  { id: 'classic', label: '🔥 Classic' },
  { id: 'ripple', label: '🌊 Ripple' },
  { id: 'burst', label: '✨ Burst' },
]

const SKIN_STORAGE_KEY = 'pushus.nose-tap-skin'

const NOSE_TAP_VIBRATION_MS = 45
const NOSE_TAP_LAP_VIBRATION = [45, 30, 45]
const NOSE_TAP_QUAKE_VIBRATION = [70, 25, 45]

function loadSkin(): NoseTapSkinId {
  try {
    const stored = window.localStorage.getItem(SKIN_STORAGE_KEY)

    if (SKINS.some((skin) => skin.id === stored)) {
      return stored as NoseTapSkinId
    }
  } catch {
    // Private mode etc. — fall through to default.
  }

  return 'bricks'
}

/** Tap position as percentages of the tap zone, re-keyed per tap. */
type TapPoint = { xPct: number; yPct: number; key: number }

const BRICK_COLS = 6
const BRICK_ROWS = 13

/**
 * 2.5D brick floor. Each tap quakes the bricks outward from the tap point —
 * shake amplitude falls off with distance and the shockwave arrives later the
 * further out a brick sits.
 */
function BricksSkin({ tap }: { tap: TapPoint | null }) {
  const rows = []

  for (let row = 0; row < BRICK_ROWS; row += 1) {
    const offset = row % 2 === 1
    const bricks = []

    for (let col = 0; col < BRICK_COLS + (offset ? 1 : 0); col += 1) {
      const xPct = offset
        ? (col - 0.5) * (100 / BRICK_COLS) + 100 / BRICK_COLS / 2
        : col * (100 / BRICK_COLS) + 100 / BRICK_COLS / 2
      const yPct = (row + 0.5) * (100 / BRICK_ROWS)

      let amplitude = 0
      let delayMs = 0

      if (tap) {
        const dx = xPct - tap.xPct
        // Compensate for the container being ~2× taller than wide.
        const dy = (yPct - tap.yPct) * 2
        const distance = Math.sqrt(dx * dx + dy * dy)
        amplitude = Math.max(0, 10 - distance / 7)
        delayMs = distance * 2.2
      }

      bricks.push(
        <div
          key={col}
          className={cn(
            'h-full flex-1 rounded-[3px]',
            tap && amplitude > 0.3 && 'brick-quake',
          )}
          style={{
            background: 'linear-gradient(180deg, #2b2b34 0%, #202027 70%, #17171d 100%)',
            borderBottom: '5px solid #0e0e12',
            borderRight: '2px solid #101015',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
            ...(tap && amplitude > 0.3
              ? ({
                  '--qa': amplitude.toFixed(2),
                  '--qd': `${Math.round(delayMs)}ms`,
                } as React.CSSProperties)
              : null),
          }}
        />,
      )
    }

    rows.push(
      <div
        key={row}
        className="flex gap-[3px]"
        style={{
          height: `${100 / BRICK_ROWS}%`,
          marginLeft: offset ? `-${100 / BRICK_COLS / 2}%` : 0,
          marginRight: offset ? `-${100 / BRICK_COLS / 2}%` : 0,
        }}
      >
        {bricks}
      </div>,
    )
  }

  return (
    <div aria-hidden="true" className="absolute inset-0" style={{ perspective: '700px' }}>
      <div
        key={tap?.key ?? 0}
        className="absolute inset-[-12%] flex flex-col gap-[3px]"
        style={{ transform: 'rotateX(28deg) scale(1.18)', transformOrigin: '50% 62%' }}
      >
        {rows}
      </div>
    </div>
  )
}

function ClassicSkin({ tap }: { tap: TapPoint | null }) {
  return (
    <span
      key={tap?.key ?? 0}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[2rem]',
        tap && 'nose-tap-flash',
      )}
    />
  )
}

function RippleSkin({ tap }: { tap: TapPoint | null }) {
  if (!tap) {
    return null
  }

  return (
    <span
      key={tap.key}
      aria-hidden="true"
      className="nose-tap-ripple pointer-events-none absolute h-10 w-10 rounded-full border-2 border-accent"
      style={{
        left: `calc(${tap.xPct}% - 1.25rem)`,
        top: `calc(${tap.yPct}% - 1.25rem)`,
      }}
    />
  )
}

const BURST_PARTICLES = 8

function BurstSkin({ tap }: { tap: TapPoint | null }) {
  if (!tap) {
    return null
  }

  return (
    <span
      key={tap.key}
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{ left: `${tap.xPct}%`, top: `${tap.yPct}%` }}
    >
      {Array.from({ length: BURST_PARTICLES }, (_, index) => {
        const angle = (index / BURST_PARTICLES) * Math.PI * 2

        return (
          <span
            key={index}
            className="nose-tap-burst absolute h-2 w-2 rounded-full bg-accent"
            style={
              {
                '--bx': `${Math.round(Math.cos(angle) * 80)}px`,
                '--by': `${Math.round(Math.sin(angle) * 80)}px`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </span>
  )
}

/**
 * Fullscreen nose-tap logging: phone on the floor, tap the big zone with your
 * nose at the bottom of each push-up. Every tap counts one rep with a
 * vibration pulse and a synth "DINK". Skins restyle the floor + tap feedback.
 */
export function NoseTapMode({ open, banking = false, onBank, onExit }: NoseTapModeProps) {
  const [count, setCount] = useState(0)
  const [tap, setTap] = useState<TapPoint | null>(null)
  const [skin, setSkin] = useState<NoseTapSkinId>(loadSkin)
  // Guard against silently throwing away counted reps: the first Exit tap with a
  // non-zero count arms a confirm, the second actually leaves.
  const [confirmingExit, setConfirmingExit] = useState(false)
  const countRef = useRef(0)
  const exitConfirmTimerRef = useRef(0)

  useEffect(() => {
    if (open) {
      setCount(0)
      countRef.current = 0
      setTap(null)
      setConfirmingExit(false)
      primeDinkAudio()
    }
  }, [open])

  useEffect(() => {
    return () => {
      window.clearTimeout(exitConfirmTimerRef.current)
    }
  }, [])

  const handleExit = useCallback(() => {
    if (banking) {
      return
    }

    // Arm the confirm on the first tap when reps would be lost; auto-disarm so a
    // stray tap doesn't leave it stuck.
    if (countRef.current > 0 && !confirmingExit) {
      setConfirmingExit(true)
      window.clearTimeout(exitConfirmTimerRef.current)
      exitConfirmTimerRef.current = window.setTimeout(() => setConfirmingExit(false), 3000)
      return
    }

    window.clearTimeout(exitConfirmTimerRef.current)
    onExit()
  }, [banking, confirmingExit, onExit])

  // Lock page scroll behind the overlay while open.
  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const selectSkin = useCallback((next: NoseTapSkinId) => {
    setSkin(next)
    setTap(null)

    try {
      window.localStorage.setItem(SKIN_STORAGE_KEY, next)
    } catch {
      // Storage unavailable — selection still applies for this session.
    }
  }, [])

  const handleTap = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (banking) {
        return
      }

      const rect = event.currentTarget.getBoundingClientRect()
      const xPct = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))
      const yPct = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))

      const next = countRef.current + 1
      countRef.current = next
      setCount(next)
      setTap((current) => ({ xPct, yPct, key: (current?.key ?? 0) + 1 }))

      const isLap = next % 10 === 0
      playDink(isLap)

      if (skin === 'bricks') {
        playQuakeRumble()
      }

      if (isRepHapticSupported()) {
        navigator.vibrate(
          skin === 'bricks'
            ? NOSE_TAP_QUAKE_VIBRATION
            : isLap
              ? NOSE_TAP_LAP_VIBRATION
              : NOSE_TAP_VIBRATION_MS,
        )
      }
    },
    [banking, skin],
  )

  if (!open) {
    return null
  }

  return (
    <div
      // Immersive fullscreen surface stays dark in both themes; the nested
      // data-theme resets the token cascade for this subtree.
      data-theme="dark"
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Nose-tap logging mode"
    >
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-text-muted">
          Nose-tap mode
        </p>
        <button
          type="button"
          onClick={handleExit}
          disabled={banking}
          className={cn(
            'rounded-[var(--radius-full)] border-2 px-4 py-2 text-xs font-bold',
            confirmingExit
              ? 'border-accent bg-accent/15 text-text-primary'
              : 'border-border bg-surface text-text-muted',
          )}
        >
          {confirmingExit ? `Discard ${count}?` : 'Exit'}
        </button>
      </div>

      <div
        className="mt-2 flex gap-2 overflow-x-auto px-4 pb-1"
        role="tablist"
        aria-label="Nose-tap skin"
      >
        {SKINS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={skin === option.id}
            onClick={() => selectSkin(option.id)}
            className={cn(
              'shrink-0 rounded-[var(--radius-full)] border-2 px-4 py-1.5 text-xs font-bold transition-[border-color,box-shadow] duration-[var(--duration-fast)]',
              skin === option.id
                ? 'border-accent bg-accent/15 text-text-primary shadow-[var(--shadow-glow-accent)]'
                : 'border-border bg-surface text-text-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* The tap zone fills most of the screen so a nose can't miss it. */}
      <button
        type="button"
        onPointerDown={handleTap}
        disabled={banking}
        aria-label="Tap to count one push-up"
        className="relative mx-4 mt-2 flex flex-1 select-none flex-col items-center justify-center overflow-hidden rounded-[2rem] border-2 border-accent/50 bg-surface/60 outline-none [touch-action:manipulation] active:border-accent"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {skin === 'bricks' ? <BricksSkin tap={tap} /> : null}
        {skin === 'classic' ? <ClassicSkin tap={tap} /> : null}
        {skin === 'ripple' ? <RippleSkin tap={tap} /> : null}
        {skin === 'burst' ? <BurstSkin tap={tap} /> : null}

        <span className="pointer-events-none relative flex flex-col items-center">
          <span
            className="font-mono text-[clamp(5rem,30vw,9rem)] font-bold tabular-nums leading-none text-text-primary"
            style={{ textShadow: '0 0 32px rgba(255, 107, 53, 0.45), 0 2px 12px rgba(0,0,0,0.8)' }}
          >
            {count}
          </span>
          <span className="mt-3 text-sm font-medium uppercase tracking-[0.18em] text-text-muted">
            reps
          </span>
          {count === 0 ? (
            <span className="mt-8 max-w-[16rem] text-center text-sm text-text-muted [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
              Phone on the floor. Tap the screen with your nose at the bottom of each rep.
            </span>
          ) : null}
        </span>
      </button>

      <div className="px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <Button
          type="button"
          fullWidth
          loading={banking}
          disabled={count === 0}
          onClick={() => onBank(countRef.current)}
          className="min-h-[var(--bank-cta-height)] text-base"
        >
          {count > 0 ? `Bank ${count} push-up${count === 1 ? '' : 's'}` : 'Tap to start'}
        </Button>
      </div>
    </div>
  )
}
