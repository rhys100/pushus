/** Shared mobile layout constants — keep in sync with tokens.css */
export const BOTTOM_NAV_HEIGHT = 'var(--bottom-nav-height)'
export const BANK_CTA_HEIGHT = '3.25rem'
export const BOTTOM_DOCK_PROMPT_RESERVE = 'var(--bottom-dock-prompt-reserve, 0px)'

export const PAGE_BOTTOM_PADDING = 'calc(2rem + max(3rem, env(safe-area-inset-bottom, 0px)))'
export const PAGE_BOTTOM_PADDING_WITH_NAV =
  'calc(var(--bottom-nav-height) + var(--bottom-dock-prompt-reserve, 0px) + 0.5rem)'

export const TOAST_ABOVE_NAV = PAGE_BOTTOM_PADDING_WITH_NAV
