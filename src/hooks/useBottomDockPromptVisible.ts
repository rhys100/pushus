import { useSyncExternalStore } from 'react'
import {
  getInstallOpenAppDockVisible,
  subscribeBottomDockPromptVisibility,
} from '@/lib/pwaInstallDockVisibility'

/** True when install or open-app dock is visible (push should defer). */
export function useInstallOpenAppDockVisible(): boolean {
  return useSyncExternalStore(
    subscribeBottomDockPromptVisibility,
    getInstallOpenAppDockVisible,
    () => false,
  )
}
