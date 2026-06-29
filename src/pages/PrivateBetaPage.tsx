import { Link } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { appConfig } from '@/lib/config'
import { getPendingInviteCode } from '@/lib/storage'
import { useAuth } from '@/providers/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function PrivateBetaPage() {
  useDocumentTitle('Private beta')
  const { signOut, appAccess, refreshAppAccess } = useAuth()
  const pendingInvite = getPendingInviteCode()

  return (
    <div className="flex min-h-screen flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-6 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-text-muted">Private beta</p>
          <h1 className="mt-2 text-2xl font-bold text-text-primary">{appConfig.deploymentName}</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {appConfig.name} is running a small private beta. You need an invite link or approved
            access to continue.
          </p>
        </div>

        <Card padding="lg" className="space-y-4">
          {pendingInvite ? (
            <p className="text-sm text-text-muted">
              We saved invite code{' '}
              <span className="font-mono text-text-primary">{pendingInvite}</span>, but your account
              is not approved yet. Ask the group organiser to confirm your email is on the beta
              list, or try the invite link again after signing in.
            </p>
          ) : (
            <p className="text-sm text-text-muted">
              Sign in with an email that has been approved, or open the invite link your group
              organiser sent you.
            </p>
          )}

          {appAccess.private_beta_enabled ? (
            <p className="rounded-[var(--radius-md)] bg-accent-muted px-3 py-2 text-xs text-text-muted">
              Private beta is active on this deployment. Random public sign-ups cannot create groups
              or join without a valid invite.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            {pendingInvite ? (
              <Link to={`/join/${pendingInvite}`}>
                <Button fullWidth type="button">
                  Retry invite link
                </Button>
              </Link>
            ) : null}
            <Button
              variant="secondary"
              fullWidth
              type="button"
              onClick={() => void refreshAppAccess()}
            >
              Check again
            </Button>
            <Button variant="ghost" fullWidth type="button" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-text-muted">
          <Link to="/about" className="text-accent hover:brightness-110">
            About {appConfig.name}
          </Link>
        </p>
      </div>
    </div>
  )
}
