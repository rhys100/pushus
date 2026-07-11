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

  // Pause the auto-dismiss while the user is reading (hover) or interacting
  // (keyboard focus within), so a toast — especially one with an action —
  // can't vanish mid-reach (WCAG 2.2.1).
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const paused = hovered || focused

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
    if (leaving || paused) {
      return
    }
    const duration = toast.durationMs ?? DEFAULT_DURATION_MS
    const timer = window.setTimeout(startDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [leaving, paused, toast.durationMs, startDismiss])

  return (
    // Announcements are handled by persistent live regions in the provider;
    // this node is purely visual (no live role) so its buttons stay reachable.
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false)
        }
      }}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-[var(--radius-md)] border py-2.5 pl-4 pr-2 shadow-[var(--shadow-toast)]',
        leaving ? 'toast-out' : 'toast-spring-in',
        variantStyles[variant],
      )}
    >
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>

      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.()
            startDismiss()
          }}
          className="flex min-h-9 shrink-0 items-center rounded-full border border-accent/50 px-3.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {toast.actionLabel}
        </button>
      ) : null}

      <button
        type="button"
        aria-label="Dismiss"
        onClick={startDismiss}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-text-muted transition-colors hover:bg-border/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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

    setToasts((current) => {
      // A stable id means "update this toast", not "add another" — replace in
      // place so we never render two nodes with the same React key.
      const existingIndex = current.findIndex((toast) => toast.id === id)
      if (existingIndex === -1) {
        return [...current, record]
      }
      const next = current.slice()
      next[existingIndex] = record
      return next
    })
    return id
  }, [])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
       * Persistent, always-mounted live regions. A live region must exist
       * before its text changes to be announced reliably, so we route toast
       * copy here rather than depending on the freshly-inserted visual node
       * (which some SRs, notably VoiceOver, skip). Danger → assertive/alert;
       * everything else → polite.
       */}
      <div aria-live="polite" className="sr-only">
        {toasts
          .filter((item) => (item.variant ?? 'default') !== 'danger')
          .map((item) => (
            <p key={item.id}>{item.message}</p>
          ))}
      </div>
      <div role="alert" aria-live="assertive" className="sr-only">
        {toasts
          .filter((item) => (item.variant ?? 'default') === 'danger')
          .map((item) => (
            <p key={item.id}>{item.message}</p>
          ))}
      </div>

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
