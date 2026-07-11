import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { defaultAppAccess, parseAppAccess, type AppAccessStatus } from '@/lib/appAccess'
import { clearAuthSessionBridge } from '@/lib/authSessionBridge'
import {
  hasRecoverableAuthSession,
  persistAuthSessionBridge,
  recoverAuthSession,
} from '@/lib/authSessionResume'
import { isProfileOnboardedFromServer } from '@/lib/postAuthNavigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import {
  clearPendingInviteCode,
  clearPendingMateCode,
  clearStoredActiveGroupId,
  getPendingInviteCode,
} from '@/lib/storage'
import type { Profile } from '@/types/database'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  profileReady: boolean
  appAccessLoading: boolean
  profileOnboarded: boolean
  appAccess: AppAccessStatus
  refreshProfile: () => Promise<void>
  refreshAppAccess: () => Promise<AppAccessStatus>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const HYDRATE_EVENTS = new Set<AuthChangeEvent>(['INITIAL_SESSION', 'SIGNED_IN', 'USER_UPDATED'])
const BRIDGE_EVENTS = new Set<AuthChangeEvent>(['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'])
/** Profile / access RPC can hang on iOS after suspend — never block the shell forever. */
const HYDRATE_FETCH_TIMEOUT_MS = 5_000
/** Absolute boot safety net if any auth path stalls (also busts a poisoned CF asset cache URL). */
const AUTH_BOOT_WATCHDOG_MS = 8_000

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load profile', error)
    return null
  }

  return data as Profile | null
}

async function fetchAppAccess(inviteCode: string | null): Promise<AppAccessStatus> {
  const { data, error } = await supabase.rpc('get_my_app_access', {
    p_invite_code: inviteCode,
  })

  if (error) {
    console.error('Failed to load app access', error)
    // Transient/network failures must not lock users out of the app.
    return defaultAppAccess
  }

  return parseAppAccess(data)
}

async function hydrateUser(nextSession: Session | null): Promise<{
  profile: Profile | null
  appAccess: AppAccessStatus
}> {
  if (!nextSession?.user) {
    return { profile: null, appAccess: defaultAppAccess }
  }

  const [profile, appAccess] = await Promise.all([
    withTimeout(fetchProfile(nextSession.user.id), HYDRATE_FETCH_TIMEOUT_MS, null),
    withTimeout(
      fetchAppAccess(getPendingInviteCode()),
      HYDRATE_FETCH_TIMEOUT_MS,
      defaultAppAccess,
    ),
  ])

  return { profile, appAccess }
}

/**
 * Supabase deadlocks if auth methods run inside onAuthStateChange.
 * Always defer recovery / follow-up auth calls off that stack.
 */
function deferAuthWork(work: () => void): void {
  window.setTimeout(work, 0)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)
  const [appAccessLoading, setAppAccessLoading] = useState(false)
  const [appAccess, setAppAccess] = useState<AppAccessStatus>(defaultAppAccess)

  const sessionRef = useRef<Session | null>(null)
  const recoveringRef = useRef(false)
  const initialHydrateDoneRef = useRef(false)
  const mountedRef = useRef(true)
  sessionRef.current = session

  const user = session?.user ?? null
  const profileOnboarded = isProfileOnboardedFromServer(profile, user?.id ?? null)

  const refreshAppAccess = useCallback(async (): Promise<AppAccessStatus> => {
    if (!user) {
      setAppAccess(defaultAppAccess)
      return defaultAppAccess
    }

    setAppAccessLoading(true)
    const nextAccess = await fetchAppAccess(getPendingInviteCode())
    setAppAccess(nextAccess)
    setAppAccessLoading(false)
    return nextAccess
  }, [user])

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setAppAccess(defaultAppAccess)
      setProfileReady(true)
      return
    }

    setProfileReady(false)
    setAppAccessLoading(true)
    const nextProfile = await fetchProfile(user.id)
    setProfile(nextProfile)
    await refreshAppAccess()
    setProfileReady(true)
  }, [user, refreshAppAccess])

  const finishHydration = useCallback((nextSession: Session | null) => {
    if (!nextSession?.user) {
      setProfile(null)
      setAppAccess(defaultAppAccess)
      setAppAccessLoading(false)
      setProfileReady(true)
      setLoading(false)
      initialHydrateDoneRef.current = true
      return
    }

    setProfileReady(false)
    setAppAccessLoading(true)

    void hydrateUser(nextSession)
      .then((nextState) => {
        if (!mountedRef.current) return
        setProfile(nextState.profile)
        setAppAccess(nextState.appAccess)
        setAppAccessLoading(false)
        setProfileReady(true)
        setLoading(false)
        initialHydrateDoneRef.current = true
      })
      .catch((error) => {
        console.error('Failed to hydrate auth user', error)
        if (!mountedRef.current) return
        setAppAccessLoading(false)
        setProfileReady(true)
        setLoading(false)
        initialHydrateDoneRef.current = true
      })
  }, [])

  const resolveSessionForHydration = useCallback(
    async (nextSession: Session | null): Promise<Session | null> => {
      if (nextSession?.user) {
        return nextSession
      }

      // Skip recovery when there is nothing local and no point waiting on network.
      // Still try the Safari↔PWA bridge (fast Cache read) for iOS hand-off.
      if (!hasRecoverableAuthSession()) {
        try {
          return await recoverAuthSession()
        } catch {
          return null
        }
      }

      return recoverAuthSession()
    },
    [],
  )

  const hydrateFromSession = useCallback(
    async (nextSession: Session | null) => {
      recoveringRef.current = true
      try {
        const resolved = await resolveSessionForHydration(nextSession)
        if (!mountedRef.current) return

        setSession(resolved)
        if (resolved) {
          void persistAuthSessionBridge(resolved)
        }
        finishHydration(resolved)
      } catch (error) {
        console.error('Auth session hydrate failed', error)
        if (!mountedRef.current) return
        setSession(null)
        finishHydration(null)
      } finally {
        recoveringRef.current = false
      }
    },
    [finishHydration, resolveSessionForHydration],
  )

  useEffect(() => {
    mountedRef.current = true
    let initialSessionHandled = false

    // Last-resort: never leave iOS on an endless blank/skeleton loader.
    const bootWatchdog = window.setTimeout(() => {
      if (!mountedRef.current || initialHydrateDoneRef.current) return
      console.warn('Auth boot watchdog fired — clearing loading state')
      setAppAccessLoading(false)
      setProfileReady(true)
      setLoading(false)
      initialHydrateDoneRef.current = true
    }, AUTH_BOOT_WATCHDOG_MS)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mountedRef.current) return

      if (HYDRATE_EVENTS.has(event)) {
        initialSessionHandled = true
        if (nextSession) {
          setSession(nextSession)
        }
        // Defer off the auth callback stack — calling refresh/setSession inside
        // onAuthStateChange can deadlock and leave iOS on a blank loading screen.
        deferAuthWork(() => {
          if (!mountedRef.current) return
          void hydrateFromSession(nextSession)
        })
        return
      }

      if (event === 'SIGNED_OUT') {
        initialSessionHandled = true
        if (recoveringRef.current) {
          // Let the in-flight recovery finish and publish the final state.
          return
        }
        setSession(null)
        setProfile(null)
        setAppAccess(defaultAppAccess)
        setAppAccessLoading(false)
        setProfileReady(true)
        setLoading(false)
        initialHydrateDoneRef.current = true
        return
      }

      if (BRIDGE_EVENTS.has(event) && nextSession) {
        setSession(nextSession)
        deferAuthWork(() => {
          void persistAuthSessionBridge(nextSession)
        })
      } else if (nextSession) {
        setSession(nextSession)
      }

      setLoading(false)
      initialHydrateDoneRef.current = true
    })

    deferAuthWork(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (!mountedRef.current || initialSessionHandled) return
        void hydrateFromSession(data.session)
      })
    })

    return () => {
      mountedRef.current = false
      window.clearTimeout(bootWatchdog)
      subscription.unsubscribe()
    }
  }, [hydrateFromSession])

  useEffect(() => {
    let cancelled = false

    async function resumeSessionOnForeground() {
      if (document.visibilityState !== 'visible') {
        return
      }

      // Wait until the first boot hydrate finishes — pageshow fires on cold
      // launch with a null session and would race (and hang) recovery.
      if (!initialHydrateDoneRef.current) {
        return
      }

      if (sessionRef.current) {
        // Session exists but iOS may have killed refresh timers — nudge a refresh
        // without blocking the UI. Failures are ignored.
        deferAuthWork(() => {
          void supabase.auth.refreshSession().then(({ data }) => {
            if (data.session) {
              void persistAuthSessionBridge(data.session)
            }
          })
        })
        return
      }

      recoveringRef.current = true
      try {
        const recovered = await recoverAuthSession()
        if (!recovered || cancelled || !mountedRef.current) {
          return
        }

        setSession(recovered)
        void persistAuthSessionBridge(recovered)
        finishHydration(recovered)
      } catch (error) {
        console.error('Foreground auth resume failed', error)
      } finally {
        recoveringRef.current = false
      }
    }

    function onVisibilityChange() {
      void resumeSessionOnForeground()
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted || !sessionRef.current) {
        void resumeSessionOnForeground()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [finishHydration])

  const signOut = useCallback(async () => {
    clearPendingInviteCode()
    clearPendingMateCode()
    clearStoredActiveGroupId()
    try {
      await clearAuthSessionBridge()
    } catch {
      // ignore
    }
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setAppAccess(defaultAppAccess)
    setProfileReady(true)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading,
      profileReady,
      appAccessLoading,
      profileOnboarded,
      appAccess,
      refreshProfile,
      refreshAppAccess,
      signOut,
    }),
    [
      session,
      user,
      profile,
      loading,
      profileReady,
      appAccessLoading,
      profileOnboarded,
      appAccess,
      refreshProfile,
      refreshAppAccess,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
