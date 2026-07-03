import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { bottomDockPromptPositionClass } from '@/lib/bottomDockPromptLayout'

type BottomDockPromptProps = {
  ariaLabel: string
  pathname: string
  children: ReactNode
}

export function BottomDockPrompt({ ariaLabel, pathname, children }: BottomDockPromptProps) {
  return (
    <div
      className={cn('fixed inset-x-0 z-40', bottomDockPromptPositionClass(pathname))}
      role="region"
      aria-label={ariaLabel}
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-prompt-panel px-4 pb-3 pt-4">{children}</div>
    </div>
  )
}

/** Secondary actions on the surface prompt panel — contrast with bg-bg. */
export const dockPromptSecondaryButtonClass =
  'border-2 border-border bg-bg text-text-primary hover:border-accent/40 hover:bg-bg/90'
