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
      className={cn('fixed inset-x-0 z-50 pb-2', bottomDockPromptPositionClass(pathname))}
      role="region"
      aria-label={ariaLabel}
    >
      <div className="dock-scrim pointer-events-none" aria-hidden="true" />
      <div className="dock-prompt-card mx-3 overflow-hidden">
        <div className="h-1 bg-accent" aria-hidden="true" />
        <div className="dock-prompt-panel px-4 pb-4 pt-3">{children}</div>
      </div>
    </div>
  )
}

/** Secondary actions on the surface prompt panel — contrast with bg-bg. */
export const dockPromptSecondaryButtonClass =
  'w-full border-2 border-border bg-bg text-text-primary hover:border-accent/40 hover:bg-bg/90 sm:w-auto'

export const dockPromptPrimaryButtonClass = 'w-full sm:w-auto'
