const visibleSources = new Set<string>()
const subscribers = new Set<() => void>()

export type BottomDockPromptSource = 'install' | 'open-app' | 'push'

/** Height reserved above bottom nav when a dock prompt is showing. */
const DOCK_PROMPT_RESERVE = '9.5rem'

let dockPromptReserve = '0px'

export function getDockPromptReserve(): string {
  return dockPromptReserve
}

export function getBottomDockPromptVisible(): boolean {
  return visibleSources.size > 0
}

/** Install / open-app docks only — push defers to these, not to itself. */
export function getInstallOpenAppDockVisible(): boolean {
  return visibleSources.has('install') || visibleSources.has('open-app')
}

function syncDockPromptReserve(): void {
  dockPromptReserve = visibleSources.size > 0 ? DOCK_PROMPT_RESERVE : '0px'

  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--bottom-dock-prompt-reserve', dockPromptReserve)
  }
}

export function setBottomDockPromptVisible(source: BottomDockPromptSource, visible: boolean): void {
  const hadVisible = visibleSources.size > 0

  if (visible) {
    visibleSources.add(source)
  } else {
    visibleSources.delete(source)
  }

  const hasVisible = visibleSources.size > 0
  syncDockPromptReserve()

  if (hadVisible === hasVisible) {
    return
  }

  subscribers.forEach((notify) => notify())
}

export function subscribeBottomDockPromptVisibility(notify: () => void): () => void {
  subscribers.add(notify)
  return () => subscribers.delete(notify)
}

/** @deprecated Use setBottomDockPromptVisible */
export function setPwaInstallDockVisible(source: 'install' | 'open-app', visible: boolean): void {
  setBottomDockPromptVisible(source, visible)
}

export type PwaDockSource = BottomDockPromptSource
