import { ButtonRouterLink, Card } from '@/components/ui'
import { InviteCodeEntry } from '@/components/group/InviteCodeEntry'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function JoinLandingPage() {
  useDocumentTitle('Join a group')
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <Card padding="lg" className="space-y-5">
          <div className="space-y-2 text-center">
            <p className="text-4xl" aria-hidden="true">
              🔗
            </p>
            <h1 className="text-xl font-bold text-text-primary">Join a group</h1>
            <p className="text-sm text-text-muted">
              Paste the invite code from your group admin to request access.
            </p>
          </div>

          <InviteCodeEntry submitLabel="Join group" />

          <ButtonRouterLink to="/login" variant="ghost" fullWidth>
            Back to sign in
          </ButtonRouterLink>
        </Card>
      </div>
    </div>
  )
}
