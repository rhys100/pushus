import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-bg hover:brightness-110 active:brightness-95 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]',
  secondary:
    'bg-surface text-text-primary border border-border hover:border-accent/40 hover:bg-surface/90',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface/80 active:bg-surface',
  danger:
    'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 active:bg-danger/20',
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
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 py-2.5',
          'text-sm font-semibold tracking-tight transition-[background-color,border-color,opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'disabled:pointer-events-none disabled:opacity-45',
          fullWidth && 'w-full',
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {loading ? <Spinner /> : null}
        <span className={cn(loading && 'opacity-80')}>{children}</span>
      </button>
    )
  },
)

Button.displayName = 'Button'
