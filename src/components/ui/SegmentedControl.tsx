import { cn } from '@/lib/cn'

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
  return (
    <div
      role="tablist"
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
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 rounded-[var(--radius-md)] border px-2 text-xs font-semibold capitalize transition-colors',
              selected
                ? 'border-accent bg-accent-muted text-accent'
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
