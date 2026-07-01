import { useEffect } from 'react'

type LaunchParams = {
  targetURL?: string
}

type LaunchQueueWindow = Window & {
  launchQueue?: {
    setConsumer: (callback: (launchParams: LaunchParams) => void) => void
  }
}

export function usePwaLaunchHandler() {
  useEffect(() => {
    const launchWindow = window as LaunchQueueWindow
    if (!launchWindow.launchQueue?.setConsumer) {
      return
    }

    launchWindow.launchQueue.setConsumer((launchParams) => {
      const target = launchParams.targetURL
      if (!target) {
        return
      }

      try {
        const next = new URL(target)
        const current = new URL(window.location.href)

        if (next.origin !== current.origin) {
          return
        }

        const nextPath = `${next.pathname}${next.search}${next.hash}`
        const currentPath = `${current.pathname}${current.search}${current.hash}`

        if (nextPath !== currentPath) {
          window.location.assign(nextPath)
        }
      } catch {
        // ignore invalid launch URL
      }
    })
  }, [])
}
