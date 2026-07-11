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
import { persistAuthSessionBridge, recoverAuthSession } from '@/lib/authSessionResume'
import { isProfileOnboardedFromServer } from '@/lib/postAuthNavigation'
import { supabase } from '@/lib/supabase'
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
    fetchProfile(nextSession.user.id),
    fetchAppAccess(getPendingInviteCode()),
  ])

  return { profile, appAccess }
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
      return
    }

    setProfileReady(false)
    setAppAccessLoading(true)

    void hydrateUser(nextSession).then((nextState) => {
      setProfile(nextState.profile)
      setAppAccess(nextState.appAccess)
      setAppAccessLoading(false)
      setProfileReady(true)
      setLoading(false)
    })
  }, [])

  const resolveSessionForHydration = useCallback(
    async (nextSession: Session | null): Promise<Session | null> => {
      if (nextSession?.user) {
        return nextSession
      }

      // Always attempt recovery — localStorage refresh token and/or Safari↔PWA bridge.
      return recoverAuthSession()
    },
    [],
  )

  const hydrateFromSession = useCallback(
    async (nextSession: Session | null) => {
      recoveringRef.current = true
      try {
        const resolved = await resolveSessionForHydration(nextSession)
        // Only publish null after recovery has finished — avoids flashing login
        // while iOS cold-start refresh / Cache bridge is still in flight.
        setSession(resolved)
        if (resolved) {
          void persistAuthSessionBridge(resolved)
        }
        finishHydration(resolved)
      } finally {
        recoveringRef.current = false
      }
    },
    [finishHydration, resolveSessionForHydration],
  )

  useEffect(() => {
    let mounted = true
    let initialSessionHandled = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return

      if (HYDRATE_EVENTS.has(event)) {
        initialSessionHandled = true
        // Do not setSession(null) here — hydrateFromSession recovers first.
        if (nextSession) {
          setSession(nextSession)
        }
        void hydrateFromSession(nextSession)
        return
      }

      if (event === 'SIGNED_OUT') {
        initialSessionHandled = true
        // Ignore a transient SIGNED_OUT that races an in-flight recovery
        // (failed proactive refresh wiping storage while we still have a bridge).
        if (recoveringRef.current) {
          return
        }
        setSession(null)
        setProfile(null)
        setAppAccess(defaultAppAccess)
        setAppAccessLoading(false)
        setProfileReady(true)
        setLoading(false)
        return
      }

      if (BRIDGE_EVENTS.has(event) && nextSession) {
        setSession(nextSession)
        void persistAuthSessionBridge(nextSession)
      } else if (nextSession) {
        setSession(nextSession)
      }

      setLoading(false)
    })

    window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (!mounted || initialSessionHandled) return
        void hydrateFromSession(data.session)
      })
    }, 0)

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [hydrateFromSession])

  useEffect(() => {
    let cancelled = false

    async function resumeSessionOnForeground() {
      if (document.visibilityState !== 'visible') {
        return
      }

      if (sessionRef.current) {
        return
      }

      // localStorage and/or Safari↔PWA Cache bridge
      recoveringRef.current = true
      try {
        const recovered = await recoverAuthSession()
        if (!recovered || cancelled) {
          return
        }

        setSession(recovered)
        void persistAuthSessionBridge(recovered)
        finishHydration(recovered)
      } finally {
        recoveringRef.current = false
      }
    }

    function onVisibilityChange() {
      void resumeSessionOnForeground()
    }

    function onPageShow(event: PageTransitionEvent) {
      // iOS often restores PWAs from bfcache; also run on plain pageshow when
      // session is still null (cold launch after magic-link completed in Safari).
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
    await clearAuthSessionBridge()
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
