import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type PointerEvent } from 'react'
import { cn } from '@/lib/cn'
import { tapHaptic } from '@/lib/haptics'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
  fullWidth?: boolean
}

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    '[background:var(--gradient-accent)] text-bg hover:brightness-110 active:brightness-95 shadow-[var(--shadow-glow-accent-strong),0_1px_0_rgba(255,255,255,0.25)_inset]',
  secondary:
    'bg-surface text-text-primary border-2 border-border hover:border-accent/40 hover:bg-surface/90',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface/80 active:bg-surface',
  danger:
    'bg-danger/15 text-danger border-2 border-danger/30 hover:bg-danger/25 active:bg-danger/20',
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  )
}

const buttonBaseClass =
  'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-[var(--radius-full)] px-6 py-3 text-sm font-bold tracking-tight transition-[background-color,border-color,opacity,transform,box-shadow,filter] duration-[var(--duration-normal)] ease-[var(--ease-spring)] active:scale-[0.96] active:duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant = 'primary', fullWidth = false, className, children, onPointerDown, ...props }, ref) => {
    const handlePointerDown = (event: PointerEvent<HTMLAnchorElement>) => {
      tapHaptic()
      onPointerDown?.(event)
    }

    return (
      <a
        ref={ref}
        onPointerDown={handlePointerDown}
        className={cn(
          buttonBaseClass,
          fullWidth && 'w-full',
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {children}
      </a>
    )
  },
)

ButtonLink.displayName = 'ButtonLink'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      type = 'button',
      onPointerDown,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        tapHaptic()
      }
      onPointerDown?.(event)
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        onPointerDown={handlePointerDown}
        aria-busy={loading || undefined}
        className={cn(
          buttonBaseClass,
          'disabled:pointer-events-none disabled:opacity-45',
          fullWidth && 'w-full',
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="motion-pop inline-flex" aria-hidden="true">
            <Spinner />
          </span>
        ) : null}
        <span className={cn(loading && 'opacity-80')}>{children}</span>
      </button>
    )
  },
)

Button.displayName = 'Button'
