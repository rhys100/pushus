/** Shared mobile layout constants — keep in sync with tokens.css */
export const BOTTOM_NAV_HEIGHT = '3.25rem'
export const BANK_CTA_HEIGHT = '3.25rem'
export const BANK_CTA_GAP = '0.75rem'
export const BANK_DISABLED_HINT_HEIGHT = '2rem'

export const PAGE_BOTTOM_PADDING = 'calc(2rem + env(safe-area-inset-bottom))'
export const PAGE_BOTTOM_PADDING_WITH_NAV = 'calc(4.5rem + env(safe-area-inset-bottom))'

export const TODAY_BOTTOM_CHROME = `calc(${BOTTOM_NAV_HEIGHT} + ${BANK_CTA_GAP} + var(--bank-hint-block) + ${BANK_CTA_HEIGHT} + env(safe-area-inset-bottom))`

export const TODAY_CONTENT_PADDING = `calc(${TODAY_BOTTOM_CHROME} + 0.5rem)`

export const TOAST_ABOVE_NAV = PAGE_BOTTOM_PADDING_WITH_NAV

export const TOAST_ABOVE_TODAY = `calc(${TODAY_BOTTOM_CHROME} + 0.5rem)`
