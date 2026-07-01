const visibleSources = new Set<string>()
const subscribers = new Set<() => void>()

export type PwaDockSource = 'install' | 'open-app'

export function getPwaInstallDockVisible(): boolean {
  return visibleSources.size > 0
}

export function setPwaInstallDockVisible(source: PwaDockSource, visible: boolean): void {
  const hadVisible = visibleSources.size > 0

  if (visible) {
    visibleSources.add(source)
  } else {
    visibleSources.delete(source)
  }

  const hasVisible = visibleSources.size > 0
  if (hadVisible === hasVisible) {
    return
  }

  subscribers.forEach((notify) => notify())
}

export function subscribePwaInstallDockVisibility(notify: () => void): () => void {
  subscribers.add(notify)
  return () => subscribers.delete(notify)
}
