import { cn } from '@/lib/cn'

export type NoseHoldHintProps = {
  show?: boolean
  onDismiss?: () => void
  className?: string
}

/** Teaching hint for the centre-hold nose reps gesture. Lives below Bank CTA. */
export function NoseHoldHint({ show = false, onDismiss, className }: NoseHoldHintProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-lg px-0 pb-2 pt-1 text-center',
        // Reserve height so the ring never jumps when the hint is dismissed permanently.
        show ? 'min-h-[3.75rem]' : 'min-h-0',
        className,
      )}
      aria-hidden={!show}
    >
      {show ? (
        <div className="flex flex-col items-center gap-1">
          <p className="max-w-[16rem] text-[0.8125rem] leading-snug text-text-secondary">
            <span className="font-semibold text-text-primary">Nose reps:</span>{' '}
            hold the centre of the ring for 1.5 seconds
          </p>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="text-[0.6875rem] font-medium text-text-secondary underline decoration-text-secondary/50 underline-offset-4 transition hover:text-text-primary hover:decoration-text-primary/60"
            >
              Don&rsquo;t remind me again
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
