import { useState } from 'react'
import { cn } from '@/lib/cn'
import { tapHaptic } from '@/lib/haptics'

export type SegmentedControlOption<T extends string> = {
  value: T
  label: string
}

export type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  // Pop only rewards a tap — the initially selected segment mounts still.
  const [interacted, setInteracted] = useState(false)

  return (
    // A single-select toggle group, not a tablist: there are no tabpanels and no
    // roving-tabindex/arrow-key model, so `role="group"` + `aria-pressed` buttons
    // is the honest, keyboard-correct semantics (each button is Tab-focusable).
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              if (!selected) {
                tapHaptic()
                setInteracted(true)
              }
              onChange(option.value)
            }}
            className={cn(
              'min-h-11 rounded-[var(--radius-md)] border px-2 text-xs font-semibold',
              'transition-[color,background-color,border-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
              'active:scale-[0.96]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60',
              selected
                ? cn('border-accent bg-accent-muted text-accent', interacted && 'motion-pop')
                : 'border-border bg-surface text-text-muted hover:border-accent/30',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
