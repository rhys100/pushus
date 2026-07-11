import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, useToast } from '@/components/ui'
import { InviteCodeEntry } from '@/components/group/InviteCodeEntry'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { appConfig } from '@/lib/config'
import { isCompleteEmailOtp, normalizeEmailOtp } from '@/lib/emailOtp'
import { isIosDevice, isStandalonePwa } from '@/lib/pwa'
import { fetchPostAuthSnapshot, navigateAfterAuth } from '@/lib/postAuthNavigation'
import { supabase } from '@/lib/supabase'
import { setPendingInviteCode } from '@/lib/storage'
import { normalizeInviteCode } from '@/lib/postAuthRouting'
import { successHaptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { withTimeoutReject } from '@/lib/withTimeout'

const authCallbackUrl = () => `${window.location.origin}/auth/callback`

/** Matches Supabase's OTP rate limit so Resend never invites a rate-limit error. */
const RESEND_COOLDOWN_SECONDS = 60
const AUTH_REQUEST_TIMEOUT_MS = 10_000

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('provider') && lower.includes('not enabled')) {
    return 'Google sign-in is not enabled on this deployment. Use email magic link instead.'
  }
  if (lower.includes('oauth') || lower.includes('google')) {
    return 'Google sign-in could not be completed. Try email magic link instead.'
  }
  if (lower.includes('rate') || lower.includes('seconds')) {
    return 'Wait a minute before requesting another sign-in email.'
  }
  return message
}

function friendlyOtpError(message?: string): string {
  const lower = message?.toLowerCase() ?? ''
  if (lower.includes('token') || lower.includes('expired') || lower.includes('invalid')) {
    return 'That code is invalid or expired. Request a new email and try again.'
  }
  return 'Could not verify the code. Check your connection and try again.'
}

export function LoginPage() {
  useDocumentTitle('Sign in')
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  // Invite entry is collapsed by default so the field + Continue don't bloat the
  // page — most people sign in with email/Google; only invitees need it.
  const [showInvite, setShowInvite] = useState(false)
  const authErrorShownRef = useRef(false)
  const sentHeadingRef = useRef<HTMLParagraphElement>(null)
  // One auth flow at a time — while a magic link is sending or Google is
  // redirecting, neither entry point should let the user kick off the other.
  const isBusy = sending || verifying || googleLoading

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1_000)
    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  useEffect(() => {
    const joinCode = normalizeInviteCode(searchParams.get('join'))
    if (joinCode) {
      setPendingInviteCode(joinCode)
    }

    const authError = searchParams.get('error_description') ?? searchParams.get('error')
    if (authError && !authErrorShownRef.current) {
      authErrorShownRef.current = true
      toast({ message: friendlyAuthError(authError), variant: 'danger' })
      window.history.replaceState({}, '', '/login')
    }
  }, [searchParams, toast])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--toast-top',
      'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
    )
    return () => {
      document.documentElement.style.removeProperty('--toast-top')
    }
  }, [])

  // The submit button vanishes when the form is swapped for the confirmation,
  // so pull focus onto its heading — keyboard/SR users get told the link went out.
  useEffect(() => {
    if (linkSent) {
      sentHeadingRef.current?.focus()
    }
  }, [linkSent])

  async function sendMagicLink(): Promise<boolean> {
    const trimmed = email.trim()
    if (!trimmed || resendCooldown > 0) return false

    setSending(true)
    try {
      const { error } = await withTimeoutReject(
        supabase.auth.signInWithOtp({
          email: trimmed,
          options: { emailRedirectTo: authCallbackUrl() },
        }),
        AUTH_REQUEST_TIMEOUT_MS,
      )

      if (error) {
        toast({ message: friendlyAuthError(error.message), variant: 'danger' })
        return false
      }

      successHaptic()
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
      return true
    } catch {
      toast({
        message: 'Could not send the sign-in email. Check your connection and try again.',
        variant: 'danger',
      })
      return false
    } finally {
      setSending(false)
    }
  }

  async function handleMagicLink(event: React.FormEvent) {
    event.preventDefault()
    if (await sendMagicLink()) {
      setLinkSent(true)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || sending) return
    if (await sendMagicLink()) {
      setOtp('')
      toast({ message: 'Sign-in email sent again. Check spam if it hides.', variant: 'success' })
    }
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault()
    const token = normalizeEmailOtp(otp)
    const trimmedEmail = email.trim()

    if (!isCompleteEmailOtp(token) || !trimmedEmail) {
      toast({ message: 'Enter the 6-digit code from your email.', variant: 'danger' })
      return
    }

    setVerifying(true)
    try {
      const { data, error } = await withTimeoutReject(
        supabase.auth.verifyOtp({
          email: trimmedEmail,
          token,
          type: 'email',
        }),
        AUTH_REQUEST_TIMEOUT_MS,
      )

      if (error || !data.session?.user) {
        toast({
          message: friendlyOtpError(error?.message),
          variant: 'danger',
        })
        return
      }

      successHaptic()
      try {
        const snapshot = await withTimeoutReject(
          fetchPostAuthSnapshot(data.session.user.id),
          AUTH_REQUEST_TIMEOUT_MS,
        )
        navigateAfterAuth(navigate, snapshot, { replace: true })
      } catch {
        // The session is valid; RequireAuth will finish routing once network returns.
        navigate('/today', { replace: true })
      }
    } catch {
      toast({
        message: 'Could not verify the code. Check your connection and try again.',
        variant: 'danger',
      })
    } finally {
      setVerifying(false)
    }
  }

  async function handleGoogleSignIn() {
    if (!appConfig.googleAuthEnabled) {
      toast({
        message: 'Google sign-in is disabled on this deployment. Use email magic link.',
        variant: 'danger',
      })
      return
    }

    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authCallbackUrl() },
    })
    if (error) {
      setGoogleLoading(false)
      toast({ message: friendlyAuthError(error.message), variant: 'danger' })
    }
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-bg px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]"
    >
      {/* Welcome, card, footer rise in one after another */}
      <div className="motion-stagger mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-6 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-text-muted">Welcome to</p>
          <h1 className="mt-1.5 text-3xl font-bold text-text-primary">{appConfig.name}</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Bank push-ups with your mates. Sign in to get started.
          </p>
          {appConfig.deploymentName.toLowerCase().includes('beta') ? (
            <p className="mt-3 rounded-[var(--radius-md)] bg-accent-muted px-3 py-2 text-xs text-text-muted">
              Private beta — you need an invite link or approved access after sign-in.
            </p>
          ) : null}
        </div>

        <Card padding="lg" className="space-y-4">
          {linkSent ? (
            <div
              className="motion-rise space-y-3 text-center"
            >
              <p
                className="motion-pop text-4xl"
                style={{ animationDelay: '120ms' }}
                aria-hidden="true"
              >
                ✉️
              </p>
              <p
                ref={sentHeadingRef}
                tabIndex={-1}
                className="text-sm font-medium text-text-primary focus:outline-none"
              >
                Check your email
              </p>
              <p className="text-sm text-text-muted">
                We sent a 6-digit sign-in code to{' '}
                <span className="font-semibold text-text-primary">{email.trim()}</span>.
              </p>
              {isIosDevice() && isStandalonePwa() ? (
                <p className="rounded-[var(--radius-md)] bg-accent-muted px-3 py-2 text-xs leading-relaxed text-text-muted">
                  Stay in this Home Screen app. Copy the code from your email and enter it below so
                  your login is saved here.
                </p>
              ) : null}
              <form className="space-y-3 text-left" onSubmit={handleVerifyOtp}>
                <div className="space-y-1.5">
                  <label htmlFor="email-otp" className="text-sm font-medium text-text-primary">
                    Sign-in code
                  </label>
                  <input
                    id="email-otp"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    enterKeyHint="done"
                    pattern="[0-9]{6}"
                    required
                    value={otp}
                    onChange={(event) => setOtp(normalizeEmailOtp(event.target.value))}
                    placeholder="123456"
                    className={cn(
                      'w-full rounded-[var(--radius-md)] border border-border bg-bg px-4 py-3 text-center',
                      'font-mono text-xl tracking-[0.35em] text-text-primary placeholder:text-text-muted',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  fullWidth
                  loading={verifying}
                  disabled={!isCompleteEmailOtp(otp) || isBusy}
                >
                  Sign in with code
                </Button>
              </form>
              <p className="text-xs leading-relaxed text-text-muted">
                Codes expire after one hour and can only be used once.
              </p>
              <Button
                variant="secondary"
                fullWidth
                loading={sending}
                disabled={resendCooldown > 0 || isBusy}
                onClick={() => void handleResend()}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
              </Button>
              <Button
                variant="ghost"
                fullWidth
                disabled={isBusy}
                onClick={() => {
                  setOtp('')
                  setLinkSent(false)
                }}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-text-primary">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={cn(
                    'w-full rounded-[var(--radius-md)] border border-border bg-bg px-4 py-3',
                    'text-sm text-text-primary placeholder:text-text-muted',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                  )}
                />
              </div>
              <Button
                type="submit"
                fullWidth
                loading={sending}
                disabled={isBusy || resendCooldown > 0}
              >
                {resendCooldown > 0
                  ? `Send another in ${resendCooldown}s`
                  : 'Email me a sign-in code'}
              </Button>
            </form>
          )}

          {!linkSent && appConfig.googleAuthEnabled ? (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-text-muted">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="secondary"
                fullWidth
                loading={googleLoading}
                disabled={isBusy}
                onClick={() => void handleGoogleSignIn()}
              >
                Continue with Google
              </Button>
            </>
          ) : null}

          {!linkSent ? (
            showInvite ? (
              <div className="motion-rise space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-text-muted">invite</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <InviteCodeEntry />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                aria-expanded={false}
                className={cn(
                  'w-full rounded-[var(--radius-sm)] py-1 text-center text-sm font-medium text-text-muted',
                  'transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                )}
              >
                Got an invite code? Enter it →
              </button>
            )
          ) : null}
        </Card>

        {!linkSent ? (
          <Link
            to="/guest"
            className="mt-4 block text-center text-sm font-medium text-text-muted transition-colors hover:text-accent"
          >
            Just want a play? Try it as a guest →
          </Link>
        ) : null}

        <p className="mt-5 text-center text-xs text-text-muted">
          By signing in you agree to train hard and log honestly.{' '}
          <Link to="/about#privacy" className="text-accent hover:brightness-110">
            Privacy
          </Link>
          {' · '}
          <Link to="/about" className="text-accent hover:brightness-110">
            About {appConfig.name}
          </Link>
        </p>
      </div>
    </div>
  )
}
