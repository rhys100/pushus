import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button, Card } from '@/components/ui'
import { getErrorMessage } from '@/lib/errors'
import { successHaptic } from '@/lib/haptics'
import { clearPendingMateCode, setPendingMateCode } from '@/lib/storage'
import { useRedeemMateCode } from '@/hooks/useMates'
import { useAuth } from '@/providers/AuthProvider'

/**
 * Landing page for shared mate links: /mates/add/:code. Public route — a
 * signed-out visitor lands here, we stash the code so it survives the sign-in /
 * onboarding round trip (redeemed by usePendingMateRedeem when they land back
 * in the app), and once authenticated + onboarded we redeem it here directly.
 */
export function MateAddPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { session, profileOnboarded, loading: authLoading } = useAuth()
  const redeem = useRedeemMateCode()
  const attempted = useRef(false)
  const [result, setResult] = useState<
    | { state: 'working' }
    | { state: 'done'; name: string; emoji: string }
    | { state: 'error'; message: string }
  >({ state: 'working' })

  // Stash the code before any redirect so a shared link survives sign-in.
  useEffect(() => {
    if (code) {
      setPendingMateCode(code)
    }
  }, [code])

  const isAuthed = Boolean(session)
  const canRedeem = isAuthed && profileOnboarded

  useEffect(() => {
    if (!code || !canRedeem || attempted.current) {
      return
    }
    attempted.current = true

    redeem
      .mutateAsync(code)
      .then((mate) => {
        successHaptic()
        clearPendingMateCode()
        setResult({ state: 'done', name: mate.display_name, emoji: mate.avatar_emoji })
      })
      .catch((error) => {
        clearPendingMateCode()
        setResult({ state: 'error', message: getErrorMessage(error, 'Invalid mate link.') })
      })
  }, [code, canRedeem, redeem])

  return (
    <AppLayout title="Add a mate" showNav={false}>
      <div className="space-y-4 pb-8">
        {authLoading ? (
          <Card padding="lg" className="motion-rise space-y-3 text-center">
            <p className="text-4xl" aria-hidden="true">
              🤝
            </p>
            <p className="text-lg font-bold text-text-primary">Opening your mate link…</p>
          </Card>
        ) : !isAuthed ? (
          <Card padding="lg" className="motion-rise space-y-3 text-center">
            <p className="text-4xl" aria-hidden="true">
              🤝
            </p>
            <p className="text-lg font-bold text-text-primary">Sign in to add your mate</p>
            <p className="text-sm text-text-muted">
              Create an account or sign in and you&apos;ll be mates the moment you&apos;re in.
            </p>
            <Button fullWidth onClick={() => navigate('/login')}>
              Sign in to continue
            </Button>
          </Card>
        ) : !profileOnboarded ? (
          <Card padding="lg" className="motion-rise space-y-3 text-center">
            <p className="text-4xl" aria-hidden="true">
              🤝
            </p>
            <p className="text-lg font-bold text-text-primary">Finish setting up first</p>
            <p className="text-sm text-text-muted">
              Set up your profile and we&apos;ll add your mate right after.
            </p>
            <Button fullWidth onClick={() => navigate('/onboarding/profile')}>
              Set up profile
            </Button>
          </Card>
        ) : result.state === 'done' ? (
          <Card padding="lg" className="motion-rise space-y-3 text-center">
            <p className="motion-pop text-4xl" style={{ animationDelay: '140ms' }} aria-hidden="true">
              {result.emoji}
            </p>
            <p className="text-lg font-bold text-text-primary">
              You and {result.name} are mates now
            </p>
            <p className="text-sm text-text-muted">
              Compare stats, nudge each other, and go head to head.
            </p>
            <Button fullWidth onClick={() => navigate('/mates')}>
              Open Mates
            </Button>
          </Card>
        ) : result.state === 'error' ? (
          <Card padding="lg" className="motion-rise space-y-3 text-center">
            <p className="text-4xl" aria-hidden="true">
              🤝
            </p>
            <p className="text-lg font-bold text-text-primary">That link didn&apos;t work</p>
            <p className="text-sm text-text-muted">{result.message}</p>
            <Button variant="secondary" fullWidth onClick={() => navigate('/mates')}>
              Back to Mates
            </Button>
          </Card>
        ) : (
          <Card padding="lg" className="motion-rise space-y-3 text-center">
            <p className="text-4xl" aria-hidden="true">
              🤝
            </p>
            <p className="text-lg font-bold text-text-primary">Adding your mate…</p>
            <p className="text-sm text-text-muted">Hang tight while we link you up.</p>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
