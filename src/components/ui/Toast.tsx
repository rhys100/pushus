import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { noticeSurfaceClass } from '@/lib/noticeStyles'

export type ToastVariant = 'default' | 'success' | 'danger'

export type ToastInput = {
  id?: string
  message: string
  variant?: ToastVariant
  durationMs?: number
  actionLabel?: string
  onAction?: () => void
  onDismiss?: () => void
}

type ToastRecord = Required<Pick<ToastInput, 'message'>> &
  Omit<ToastInput, 'message'> & {
    id: string
  }

type ToastContextValue = {
  toast: (input: ToastInput) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION_MS = 5000

const variantStyles: Record<ToastVariant, string> = {
  default: noticeSurfaceClass.default,
  success: noticeSurfaceClass.success,
  danger: noticeSurfaceClass.danger,
}

/** How long the toast-out animation runs before the node is removed. */
const TOAST_EXIT_MS = 200

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord
  onDismiss: (id: string) => void
}) {
  const variant = toast.variant ?? 'default'
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)

  // Leave in two beats: play the exit animation, then remove the node.
  const startDismiss = useCallback(() => {
    if (leavingRef.current) {
      return
    }
    leavingRef.current = true
    toast.onDismiss?.()
    setLeaving(true)
  }, [toast])

  useEffect(() => {
    if (!leaving) {
      return
    }
    const timer = window.setTimeout(() => onDismiss(toast.id), TOAST_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [leaving, onDismiss, toast.id])

  useEffect(() => {
    const duration = toast.durationMs ?? DEFAULT_DURATION_MS
    const timer = window.setTimeout(startDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [toast.durationMs, startDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 shadow-[var(--shadow-toast)]',
        leaving ? 'toast-out' : 'toast-spring-in',
        variantStyles[variant],
      )}
    >
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>

      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.()
            startDismiss()
          }}
          className="shrink-0 rounded-[var(--radius-sm)] px-1 text-sm font-semibold text-accent hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {toast.actionLabel}
        </button>
      ) : null}

      <button
        type="button"
        aria-label="Dismiss"
        onClick={startDismiss}
        className="-my-1 -mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-lg leading-none text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        ×
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback((input: ToastInput) => {
    const id = input.id ?? `toast-${++idRef.current}`
    const record: ToastRecord = { ...input, id }

    setToasts((current) => [...current, record])
    return id
  }, [])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-label="Notifications"
        className={cn(
          'pointer-events-none fixed inset-x-0 top-[var(--toast-top)] z-[60]',
          'mx-auto flex max-w-lg flex-col gap-2 px-4',
        )}
      >
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }

  return context
}
