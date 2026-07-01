import { useMemo } from 'react'
import { Button, ButtonLink } from '@/components/ui'
import { usePwaOpenAppPrompt } from '@/hooks/usePwaOpenAppPrompt'
import { cn } from '@/lib/cn'
import { buildPwaOpenInAppUrl, canTryOpenInInstalledApp } from '@/lib/pwaOpenInApp'

const TAB_NAV_PATHS = ['/leaderboard', '/activity', '/group', '/settings'] as const

function promptBottomClass(pathname: string): string {
  if (TAB_NAV_PATHS.some((path) => pathname.startsWith(path))) {
    return 'bottom-[var(--bottom-nav-height)]'
  }

  return 'bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]'
}

export function PwaOpenAppPrompt() {
  const { visible, confidence, platform, dismissPermanently, acknowledgeOpenInApp, pathname } =
    usePwaOpenAppPrompt()
  const openInAppUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return buildPwaOpenInAppUrl(pathname)
    }

    return buildPwaOpenInAppUrl(pathname, window.location.origin)
  }, [pathname])

  if (!visible) {
    return null
  }

  const isIos = platform === 'ios'
  const canTryOpenInApp = canTryOpenInInstalledApp(platform)
  const knownInstalled = confidence === 'known'

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-40',
        promptBottomClass(pathname),
      )}
      role="region"
      aria-label="Open installed PushUS prompt"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel px-4 pb-3 pt-3">
        <p className="text-sm font-semibold text-text-primary">
          {isIos ? 'Use the PushUS home screen app' : 'Open PushUS in the installed app'}
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {isIos ? (
            <>
              Safari cannot switch to the home screen app for you. Go to your home screen and tap
              the PushUS icon
              {knownInstalled ? ' you already added' : ''} for reliable reminders.
            </>
          ) : (
            <>
              Tap <span className="font-medium text-text-primary">Open in app</span> to launch the
              installed PushUS app. If Chrome stays in this tab, open PushUS from your home screen or
              app drawer.
            </>
          )}
        </p>
        {isIos ? (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-muted">
            <li>Leave this Safari tab or press the home button.</li>
            <li>Tap the PushUS icon on your home screen.</li>
          </ol>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {canTryOpenInApp ? (
            <ButtonLink href={openInAppUrl} onClick={acknowledgeOpenInApp}>
              Open in app
            </ButtonLink>
          ) : (
            <Button onClick={acknowledgeOpenInApp}>OK, I&apos;ll use the home screen icon</Button>
          )}
          <Button variant="secondary" onClick={dismissPermanently}>
            Don&apos;t remind me again
          </Button>
        </div>
      </div>
    </div>
  )
}
