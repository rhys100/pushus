let pwaInstallDockVisible = false
const subscribers = new Set<() => void>()

export function getPwaInstallDockVisible(): boolean {
  return pwaInstallDockVisible
}

export function setPwaInstallDockVisible(visible: boolean): void {
  if (pwaInstallDockVisible === visible) {
    return
  }

  pwaInstallDockVisible = visible
  subscribers.forEach((notify) => notify())
}

export function subscribePwaInstallDockVisibility(notify: () => void): () => void {
  subscribers.add(notify)
  return () => subscribers.delete(notify)
}
