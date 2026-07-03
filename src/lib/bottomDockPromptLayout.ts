import { PWA_OPEN_APP_PROMPT_BOTTOM_NAV_PATHS } from '@/lib/pwaOpenAppPrompt'

/** Routes with a fixed bottom nav — dock prompts sit above it. */
export function bottomDockPromptSitsAboveBottomNav(pathname: string): boolean {
  return (PWA_OPEN_APP_PROMPT_BOTTOM_NAV_PATHS as readonly string[]).includes(pathname)
}

export function bottomDockPromptPositionClass(pathname: string): string {
  if (bottomDockPromptSitsAboveBottomNav(pathname)) {
    return 'bottom-[var(--bottom-nav-height)]'
  }

  return 'bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]'
}

/** Reserve scroll space when a bottom dock prompt is visible above the nav. */
export const BOTTOM_DOCK_PROMPT_RESERVE = 'var(--bottom-dock-prompt-reserve, 0px)'
