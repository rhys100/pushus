import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchPostAuthSnapshot,
  navigateAfterAuth,
} from '@/lib/postAuthNavigation'
import { ButtonRouterLink } from '@/components/ui'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { supabase } from '@/lib/supabase'

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('provider') && lower.includes('not enabled')) {
    return 'Google sign-in is not enabled on this deployment. Use email magic link instead.'
  }
  if (lower.includes('oauth') || lower.includes('google')) {
    return 'Google sign-in could not be completed. Try email magic link instead.'
  }
  return message
}

export function AuthCallbackPage() {
  useDocumentTitle('Signing in')
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    // Escape hatch: if any auth call hangs (flaky network, half-consumed code)
    // the user would sit on the skeleton forever. Surface the error view so
    // "Back to login" appears. Cleared once handleCallback settles.
    const timeoutId = window.setTimeout(() => {
      if (mounted) {
        setError('This is taking longer than expected. Head back and try signing in again.')
      }
    }, 15_000)

    async function handleCallback() {
      try {
        const hashParams = new URLSearchParams(window.location.hash.slice(1))
        const queryParams = new URLSearchParams(window.location.search)
        const authError =
          hashParams.get('error_description') ??
          queryParams.get('error_description') ??
          hashParams.get('error') ??
          queryParams.get('error')

        if (authError) {
          if (mounted) setError(friendlyAuthError(authError))
          return
        }

        const { data, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          if (mounted) setError(sessionError.message)
          return
        }

        if (!data.session) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href,
          )
          if (exchangeError) {
            if (mounted) setError(friendlyAuthError(exchangeError.message))
            return
          }
        }

        const { data: refreshed } = await supabase.auth.getSession()
        const session = refreshed.session
        const user = session?.user

        if (!user || !session) {
          if (mounted) {
            setError('Sign-in could not be completed. Try again from the login page.')
          }
          return
        }

        const snapshot = await fetchPostAuthSnapshot(user.id)

        if (mounted) {
          navigateAfterAuth(navigate, snapshot, { replace: true })
        }
      } finally {
        // Settled (success or handled error) — the hang timeout is no longer needed.
        window.clearTimeout(timeoutId)
      }
    }

    void handleCallback()

    return () => {
      mounted = false
      window.clearTimeout(timeoutId)
    }
  }, [navigate])

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-4">
        <div className="w-full max-w-xs space-y-4 text-center" role="alert">
          <p className="text-4xl" aria-hidden="true">
            ⚠️
          </p>
          <div className="space-y-1.5">
            <p className="text-lg font-semibold text-text-primary">Sign-in failed</p>
            <p className="text-sm text-text-muted">{error}</p>
          </div>
          <ButtonRouterLink to="/login" variant="secondary" fullWidth>
            Back to login
          </ButtonRouterLink>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-xs space-y-3" role="status" aria-live="polite">
        <Skeleton className="mx-auto h-12 w-12 rounded-full" />
        <p className="text-center text-sm text-text-muted">Signing you in…</p>
      </div>
    </div>
  )
}
