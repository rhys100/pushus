/**
 * Theme management: dark (brand default), light, or follow-system.
 * The resolved theme lives on <html data-theme="...">; index.html sets it
 * pre-paint from the same storage key to avoid a flash of the wrong theme.
 */

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pushus-theme'

/** Browser-chrome colour behind the status bar, per resolved theme. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: '#0a0a0d',
  light: '#f4f4f7',
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function getStoredThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light'
  }

  return preference
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = theme

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', THEME_COLOR[theme])
  }
}

export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(getStoredThemePreference(), systemPrefersDark())
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY)
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference)
    }
  } catch {
    // ignore quota / private mode
  }

  applyTheme(resolveTheme(preference, systemPrefersDark()))
}

/**
 * Apply the stored preference and track system changes while in system mode.
 * Call once at app start; returns a cleanup for tests.
 */
export function initTheme(): () => void {
  applyTheme(getResolvedTheme())

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getStoredThemePreference() === 'system') {
      applyTheme(resolveTheme('system', media.matches))
    }
  }

  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
