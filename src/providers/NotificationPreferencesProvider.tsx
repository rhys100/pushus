import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import {
  useNotificationPreferencesState,
  type NotificationPreferences,
} from '@/hooks/useNotificationPreferences'
import type { NotificationPreferencesInput } from '@/lib/notificationEligibility'
import {
  ensurePushSubscriptionForUser,
  type PushPermissionStatus,
  type PushSupportStatus,
} from '@/lib/notifications/registerPush'
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

  // Self-heal push after a 410/404 disabled the subscription server-side. The
  // browser subscription still exists and Settings still shows push on, but
  // every push is dropped until the user re-toggles. On boot (production only),
  // if permission is granted and prefs say push is on, re-upsert the
  // subscription with enabled=true. Runs once per signed-in user per session.
  const healedForUserRef = useRef<string | null>(null)
  const userId = user?.id
  const pushEnabled = state.prefs?.push_enabled === true
  const pushPermission = state.pushPermission
  useEffect(() => {
    if (!import.meta.env.PROD) return
    if (!userId || !pushEnabled || pushPermission !== 'granted') return
    if (healedForUserRef.current === userId) return
    healedForUserRef.current = userId
    void ensurePushSubscriptionForUser(userId).catch((error) => {
      console.warn('[push self-heal]', error)
    })
  }, [userId, pushEnabled, pushPermission])

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
