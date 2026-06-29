import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Skeleton, useToast } from '@/components/ui'
import { pickMembershipState } from '@/lib/postAuthNavigation'
import { normalizeInviteCode } from '@/lib/postAuthRouting'
import { supabase } from '@/lib/supabase'
import {
  clearPendingInviteCode,
  setPendingInviteCode,
} from '@/lib/storage'
import { useAuth } from '@/providers/AuthProvider'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

type JoinState =
  | 'loading_preview'
  | 'preview'
  | 'redirecting_profile'
  | 'joining'
  | 'success'
  | 'error'

function isAlreadyMemberError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('already a member') || lower.includes('already pending')
}

export function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { session, user, profileOnboarded, loading: authLoading } = useAuth()
  const { refreshGroup, pendingGroupId, membershipStatus } = useActiveGroup()
  const [state, setState] = useState<JoinState>('loading_preview')
  const [isJoining, setIsJoining] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [groupName, setGroupName] = useState<string | null>(null)
  const attemptedRef = useRef(false)

  const inviteCode = normalizeInviteCode(code ?? '')

  useDocumentTitle(groupName ? `Join ${groupName}` : 'Join a group')

  useEffect(() => {
    if (!inviteCode) return
    setPendingInviteCode(inviteCode)
  }, [inviteCode])

  useEffect(() => {
    if (!inviteCode) return

    let mounted = true

    async function loadPreview() {
      const { data, error } = await supabase.rpc('get_invite_group_preview', {
        p_invite_code: inviteCode,
      })

      if (!mounted) return

      if (error || !data || typeof data !== 'object' || !('name' in data)) {
        setGroupName(null)
        setState('preview')
        return
      }

      setGroupName(String((data as { name: string }).name))
      setState('preview')
    }

    void loadPreview()

    return () => {
      mounted = false
    }
  }, [inviteCode])

  useEffect(() => {
    if (!inviteCode || authLoading || !session) return

    if (!profileOnboarded) {
      setState('redirecting_profile')
      navigate('/onboarding/profile', { replace: true })
      return
    }

    if (membershipStatus === 'active') {
      clearPendingInviteCode()
      navigate('/today', { replace: true })
      return
    }

    if (membershipStatus === 'pending' || pendingGroupId) {
      clearPendingInviteCode()
      navigate('/pending', { replace: true })
      return
    }

    if (attemptedRef.current) return
    attemptedRef.current = true
    void joinGroup()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-join once when ready
  }, [
    inviteCode,
    authLoading,
    session,
    profileOnboarded,
    membershipStatus,
    pendingGroupId,
    navigate,
  ])

  async function joinGroup() {
    if (!inviteCode) return

    setState('joining')
    setIsJoining(true)
    setErrorMessage(null)

    const { error } = await supabase.rpc('request_join_group', {
      p_invite_code: inviteCode,
    })

    setIsJoining(false)

    if (error) {
      if (isAlreadyMemberError(error.message)) {
        await refreshGroup()
        clearPendingInviteCode()
        const { data: memberships } = await supabase
          .from('group_members')
          .select('*')
          .eq('user_id', user!.id)
          .in('status', ['active', 'pending'])

        const { hasActiveGroup, pendingGroupId: pendingId } = pickMembershipState(
          (memberships ?? []) as Parameters<typeof pickMembershipState>[0],
        )

        navigate(hasActiveGroup ? '/today' : pendingId ? '/pending' : '/pending', {
          replace: true,
        })
        return
      }

      setState('error')
      setErrorMessage(error.message)
      toast({ message: error.message, variant: 'danger' })
      return
    }

    clearPendingInviteCode()
    await refreshGroup()

    setState('success')
    toast({ message: "You're in!", variant: 'success' })
    navigate('/today', { replace: true })
  }

  if (!inviteCode) {
    return (
      <div className="flex min-h-screen flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <Card padding="lg" className="space-y-4 text-center">
            <p className="text-4xl" aria-hidden="true">
              🔗
            </p>
            <h1 className="text-xl font-bold text-text-primary">Invalid invite link</h1>
            <p className="text-sm text-text-muted">
              This join link is missing or has an invalid invite code. Ask your group admin for a
              fresh link.
            </p>
            <Link to="/join">
              <Button variant="secondary" fullWidth type="button">
                Enter invite code
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" fullWidth type="button">
                Back to sign in
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <Card padding="lg" className="space-y-4 text-center">
            {state === 'loading_preview' ? (
              <>
                <Skeleton className="mx-auto h-10 w-10 rounded-full" />
                <Skeleton className="mx-auto h-5 w-48" />
              </>
            ) : (
              <>
                <p className="text-4xl" aria-hidden="true">
                  👋
                </p>
                <h1 className="text-xl font-bold text-text-primary">
                  {groupName ? `Join ${groupName}` : 'Join a PushUS group'}
                </h1>
                <p className="text-sm text-text-muted">
                  {groupName
                    ? 'Sign in to join. You will set up your profile, then you can start logging push-ups.'
                    : 'This invite link may be invalid or expired. You can still sign in and try again.'}
                </p>
                <p className="text-xs text-text-muted">
                  Invite code:{' '}
                  <span className="font-mono text-text-primary">{inviteCode}</span>
                </p>
                <Link to={`/login?join=${encodeURIComponent(inviteCode)}`}>
                  <Button fullWidth type="button">
                    Sign in to join
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="ghost" fullWidth type="button">
                    Back to sign in
                  </Button>
                </Link>
              </>
            )}
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <Card padding="lg" className="space-y-4 text-center">
          {state === 'joining' ||
          state === 'redirecting_profile' ||
          (state === 'preview' && session && profileOnboarded) ? (
            <>
              <Skeleton className="mx-auto h-10 w-10 rounded-full" />
              <h1 className="text-xl font-bold text-text-primary">Joining group…</h1>
              <p className="text-sm text-text-muted">
                Using invite code{' '}
                <span className="font-mono text-text-primary">{inviteCode}</span>.
              </p>
            </>
          ) : state === 'error' ? (
            <>
              <p className="text-4xl" aria-hidden="true">
                ⚠️
              </p>
              <h1 className="text-xl font-bold text-text-primary">Could not join</h1>
              <p className="text-sm text-danger">{errorMessage ?? 'Something went wrong.'}</p>
              <Button
                variant="secondary"
                fullWidth
                loading={isJoining}
                disabled={isJoining}
                onClick={() => {
                  attemptedRef.current = false
                  void joinGroup()
                }}
              >
                Try again
              </Button>
              <Link to="/private-beta">
                <Button variant="ghost" fullWidth type="button">
                  Back
                </Button>
              </Link>
            </>
          ) : (
            <>
              <p className="text-4xl" aria-hidden="true">
                ✓
              </p>
              <h1 className="text-xl font-bold text-text-primary">You&apos;re in!</h1>
              <p className="text-sm text-text-muted">Redirecting to Today…</p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
