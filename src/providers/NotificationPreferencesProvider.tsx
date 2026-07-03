import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import {
  useNotificationPreferencesState,
  type NotificationPreferences,
} from '@/hooks/useNotificationPreferences'
import type { NotificationPreferencesInput } from '@/lib/notificationEligibility'
import type { PushPermissionStatus, PushSupportStatus } from '@/lib/notifications/registerPush'
import type { PwaInstallStatus } from '@/lib/pwaInstallStatus'
import { useAuth } from '@/providers/AuthProvider'

type NotificationPreferencesContextValue = {
  prefs: NotificationPreferences | null
  loading: boolean
  saving: boolean
  registering: boolean
  error: string | null
  refresh: () => Promise<void>
  updatePreferences: (patch: Partial<NotificationPreferencesInput>) => Promise<boolean>
  enablePush: () => Promise<boolean>
  disablePush: () => Promise<boolean>
  refreshInstallStatus: () => Promise<PwaInstallStatus>
  installStatus: PwaInstallStatus | null
  installStatusLoading: boolean
  pushSupport: PushSupportStatus
  pushPermission: PushPermissionStatus
  pushCapability: PushSupportStatus
}

const NotificationPreferencesContext =
  createContext<NotificationPreferencesContextValue | null>(null)

export function NotificationPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const state = useNotificationPreferencesState(user?.id)

  return (
    <NotificationPreferencesContext.Provider value={state}>
      {children}
    </NotificationPreferencesContext.Provider>
  )
}

export function useNotificationPreferences(): NotificationPreferencesContextValue {
  const context = useContext(NotificationPreferencesContext)

  if (!context) {
    throw new Error('useNotificationPreferences must be used within NotificationPreferencesProvider')
  }

  return context
}
