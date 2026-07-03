export type NoticeTone = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'accent'

/**
 * Opaque notice surfaces — readable over page content and on tinted cards.
 * Avoid low-alpha semantic backgrounds (e.g. bg-success/10) on floating toasts.
 */
export const noticeSurfaceClass: Record<NoticeTone, string> = {
  default: 'border-border bg-surface text-text-primary',
  info: 'border-border bg-surface text-text-primary',
  success: 'border-success/50 bg-surface text-text-primary',
  warning: 'border-warning/50 bg-surface text-text-primary',
  danger: 'border-danger/50 bg-surface text-text-primary',
  accent: 'border-accent/50 bg-surface text-text-primary',
}

export const noticeBannerClass = (tone: NoticeTone) =>
  `rounded-[var(--radius-md)] border px-4 py-3 ${noticeSurfaceClass[tone]}`

export const noticeInlineClass = (tone: NoticeTone) =>
  `rounded-[var(--radius-md)] border px-3 py-2 text-xs text-text-primary ${noticeSurfaceClass[tone]}`
