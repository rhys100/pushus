import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { defaultAppAccess, parseAppAccess, type AppAccessStatus } from '@/lib/appAccess'
import { isProfileOnboardedFromServer } from '@/lib/postAuthNavigation'
import { supabase } from '@/lib/supabase'
import { clearPendingInviteCode, clearStoredActiveGroupId, getPendingInviteCode } from '@/lib/storage'
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

  useEffect(() => {
    let mounted = true
    let initialSessionHandled = false

    function finishHydration(nextSession: Session | null) {
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
        if (!mounted) return
        setProfile(nextState.profile)
        setAppAccess(nextState.appAccess)
        setAppAccessLoading(false)
        setProfileReady(true)
        setLoading(false)
      })
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return

      setSession(nextSession)

      if (HYDRATE_EVENTS.has(event)) {
        initialSessionHandled = true
        finishHydration(nextSession)
        return
      }

      if (event === 'SIGNED_OUT') {
        initialSessionHandled = true
        setProfile(null)
        setAppAccess(defaultAppAccess)
        setAppAccessLoading(false)
        setProfileReady(true)
        setLoading(false)
        return
      }

      setLoading(false)
    })

    window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (!mounted || initialSessionHandled) return
        setSession(data.session)
        finishHydration(data.session)
      })
    }, 0)

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    clearPendingInviteCode()
    clearStoredActiveGroupId()
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
