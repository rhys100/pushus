import { Navigate, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui'
import { resolvePostAuthPath } from '@/lib/postAuthRouting'
import { getPendingInviteCode } from '@/lib/storage'
import { useAuth } from '@/providers/AuthProvider'
import { useGroup } from '@/providers/GroupProvider'

export type RequireAuthMode =
  | 'guest'
  | 'auth'
  | 'onboarded'
  | 'pending'
  | 'member'
  | 'app'

type RequireAuthProps = {
  children: React.ReactNode
  mode?: RequireAuthMode
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
      <div className="w-full max-w-xs space-y-3">
        <Skeleton className="mx-auto h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

export function RequireAuth({ children, mode = 'member' }: RequireAuthProps) {
  const {
    session,
    loading: authLoading,
    profileReady,
    profileOnboarded,
    appAccess,
    appAccessLoading,
  } = useAuth()
  const {
    hasActiveGroup,
    pendingGroupId,
    loading: groupLoading,
  } = useGroup()
  const location = useLocation()

  const pendingInviteCode = getPendingInviteCode()
  const skipGroupWaitForSettings =
    mode === 'onboarded' && location.pathname.startsWith('/settings')
  const needsGroupContext =
    !skipGroupWaitForSettings &&
    (mode === 'onboarded' ||
      mode === 'pending' ||
      mode === 'member' ||
      (mode === 'guest' && Boolean(session) && profileOnboarded))
  const loading =
    authLoading ||
    (session && !profileReady) ||
    (session && appAccessLoading) ||
    (session && profileOnboarded && needsGroupContext && groupLoading)

  if (loading) {
    return <LoadingScreen />
  }

  const isAuthenticated = Boolean(session)

  if (mode === 'guest') {
    if (isAuthenticated) {
      const target = resolvePostAuthPath({
        profileOnboarded,
        pendingGroupId,
        hasActiveGroup,
        appAccessAllowed: appAccess.allowed,
        canCreateGroup: appAccess.can_create_group,
        pendingInviteCode,
      })
      return <Navigate to={target} replace />
    }
    return children
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (mode === 'auth') {
    return children
  }

  if (mode === 'app') {
    if (!profileOnboarded) {
      return <Navigate to="/onboarding/profile" state={{ from: location.pathname }} replace />
    }
    if (!appAccess.allowed) {
      return <Navigate to="/private-beta" replace />
    }
    return children
  }

  if (!profileOnboarded) {
    return <Navigate to="/onboarding/profile" state={{ from: location.pathname }} replace />
  }

  if (!appAccess.allowed) {
    return <Navigate to="/private-beta" replace />
  }

  if (mode === 'onboarded') {
    if (pendingGroupId && !hasActiveGroup) {
      return <Navigate to="/pending" replace />
    }
    return children
  }

  if (mode === 'pending') {
    if (hasActiveGroup) {
      return <Navigate to="/today" replace />
    }
    if (!pendingGroupId) {
      const target = resolvePostAuthPath({
        profileOnboarded,
        pendingGroupId,
        hasActiveGroup,
        appAccessAllowed: appAccess.allowed,
        canCreateGroup: appAccess.can_create_group,
        pendingInviteCode,
      })
      return <Navigate to={target} replace />
    }
    return children
  }

  if (mode === 'member') {
    if (pendingGroupId && !hasActiveGroup) {
      return <Navigate to="/pending" replace />
    }
    if (!hasActiveGroup) {
      const target = resolvePostAuthPath({
        profileOnboarded,
        pendingGroupId,
        hasActiveGroup,
        appAccessAllowed: appAccess.allowed,
        canCreateGroup: appAccess.can_create_group,
        pendingInviteCode,
      })
      return <Navigate to={target} replace />
    }
    return children
  }

  return children
}
