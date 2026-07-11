import { useLocation, useNavigate } from 'react-router-dom'
import { ButtonRouterLink, Card } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { appConfig } from '@/lib/config'
import { APP_BUILD_ID } from '@/lib/buildId'
import { APP_VERSION } from '@/lib/appVersionLabel'
import { noticeBannerClass } from '@/lib/noticeStyles'
import { PAGE_BOTTOM_PADDING } from '@/lib/layout'

function licenseUrl(): string {
  if (appConfig.sourceRepoUrl) {
    return `${appConfig.sourceRepoUrl.replace(/\/$/, '')}/blob/main/LICENSE`
  }
  // No repo configured — a relative '/LICENSE' resolves to the SPA router (404),
  // so fall back to the canonical AGPL-3.0 text hosted by the FSF.
  return 'https://www.gnu.org/licenses/agpl-3.0.html'
}

export function AboutPage() {
  useDocumentTitle('About')
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const deploymentLabel = appConfig.deploymentName || appConfig.name

  // Return to wherever they came from (login footer, Settings, private-beta).
  // location.key === 'default' means a direct load with no in-app history, so
  // fall back to a sensible home for their auth state.
  function handleBack() {
    if (location.key !== 'default') {
      navigate(-1)
    } else {
      navigate(session ? '/settings' : '/login')
    }
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-bg px-4 pt-[max(2rem,env(safe-area-inset-top))]"
      style={{ paddingBottom: PAGE_BOTTOM_PADDING }}
    >
      <div className="mx-auto w-full max-w-sm flex-1 py-6">
        <button
          type="button"
          onClick={handleBack}
          className="mb-6 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] text-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold text-text-primary">About {appConfig.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Bank push-ups with your mates. Privacy-first, self-hostable push-up challenge app.
        </p>

        <Card padding="lg" className="mt-6 space-y-4">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-text-primary">Deployment</h2>
            <p className="text-sm text-text-muted">
              You are using <span className="text-text-primary">{deploymentLabel}</span>
              {APP_VERSION !== '0.0.0' ? (
                <>
                  {' '}
                  (<span className="font-mono text-text-primary">v{APP_VERSION}</span>)
                </>
              ) : null}
            </p>
            {APP_BUILD_ID !== 'dev' ? (
              <p className="text-xs text-text-muted">
                App build <span className="font-mono text-text-primary">{APP_BUILD_ID}</span>
              </p>
            ) : null}
            {appConfig.billingEnabled ? (
              <p className="text-sm leading-relaxed text-text-muted">
                This is the official <strong className="font-medium text-text-primary">PushUS Cloud</strong>{' '}
                hosted service. You pay for managed hosting, convenience, and support. The app
                source remains open under AGPL-3.0-only.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-text-muted">
                This is a <strong className="font-medium text-text-primary">Community</strong>{' '}
                deployment. You can self-host on your own Supabase project with billing disabled.
              </p>
            )}
          </section>

          {appConfig.isModifiedFork ? (
            <section className={noticeBannerClass('warning')}>
              <h2 className="text-sm font-semibold text-text-primary">Modified version</h2>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                This deployment is a modified fork of PushUS. It is not the official PushUS Cloud
                service unless stated above.
              </p>
            </section>
          ) : null}

          <section id="privacy" className="space-y-2 scroll-mt-6">
            <h2 className="text-sm font-semibold text-text-primary">Privacy</h2>
            <p className="text-sm leading-relaxed text-text-muted">
              Your reps, profile, and group membership live in this deployment&apos;s own Supabase
              database — nothing is sold, shared with advertisers, or synced anywhere else. Guest
              reps never leave your device. Self-hosters own their data outright.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-text-primary">Licence</h2>
            <p className="text-sm leading-relaxed text-text-muted">
              PushUS is licensed under{' '}
              <a
                href={licenseUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:brightness-110"
              >
                AGPL-3.0-only
              </a>
              . You can fork, modify, self-host, and use the software commercially. If you modify
              PushUS and host it for users over a network, you must make your modified source
              available under the same licence.
            </p>
          </section>

          {appConfig.sourceRepoUrl ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-text-primary">Source code</h2>
              <a
                href={appConfig.sourceRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center break-all rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm font-semibold text-accent hover:brightness-110"
              >
                {appConfig.sourceRepoUrl}
              </a>
            </section>
          ) : null}
        </Card>

        {!session ? (
          <ButtonRouterLink to="/login" variant="secondary" fullWidth className="mt-6">
            Sign in
          </ButtonRouterLink>
        ) : null}
      </div>
    </div>
  )
}
