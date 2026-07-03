import { Button } from '@/components/ui'
import {
  BottomDockPrompt,
  dockPromptPrimaryButtonClass,
  dockPromptSecondaryButtonClass,
} from '@/components/BottomDockPrompt'
import { usePwaOpenAppPrompt } from '@/hooks/usePwaOpenAppPrompt'
import { canTryOpenInInstalledApp, openInstalledPwa } from '@/lib/pwaOpenInApp'

function HomeScreenSteps({ compact = false }: { compact?: boolean }) {
  return (
    <ol
      className={
        compact
          ? 'mt-2 list-decimal space-y-1 pl-5 text-sm leading-snug text-text-muted'
          : 'mt-3 space-y-2'
      }
    >
      {compact ? (
        <>
          <li>Press Home or swipe up from the bottom.</li>
          <li>Tap the PushUS icon on your home screen (not Chrome).</li>
        </>
      ) : (
        <>
          <li className="flex gap-3 text-sm text-text-primary">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent">
              1
            </span>
            <span className="pt-0.5">Press Home or swipe up from the bottom of the screen.</span>
          </li>
          <li className="flex gap-3 text-sm text-text-primary">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-xs font-bold text-accent">
              2
            </span>
            <span className="pt-0.5">Tap the PushUS icon on your home screen — not the Chrome app.</span>
          </li>
        </>
      )}
    </ol>
  )
}

export function PwaOpenAppPrompt() {
  const {
    visible,
    confidence,
    platform,
    webApkPackage,
    dismissPermanently,
    acknowledgeOpenInApp,
    pathname,
  } = usePwaOpenAppPrompt()

  if (!visible) {
    return null
  }

  const isIos = platform === 'ios'
  const canTryOpenInApp = canTryOpenInInstalledApp(platform)
  const knownInstalled = confidence === 'known'

  const handleTryOpenInApp = () => {
    acknowledgeOpenInApp()
    openInstalledPwa(pathname, window.location.origin, webApkPackage)
  }

  return (
    <BottomDockPrompt ariaLabel="Open installed PushUS prompt" pathname={pathname}>
      <div className="flex items-start gap-3">
        <img
          src="/pwa/icon-192.png"
          alt=""
          aria-hidden="true"
          className="h-11 w-11 shrink-0 rounded-[0.85rem] border border-border bg-bg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">
            {isIos ? 'Use the PushUS home screen app' : 'PushUS is installed — use the home screen app'}
          </p>
          <p className="mt-1 text-sm leading-snug text-text-muted">
            {isIos ? (
              <>
                Safari cannot switch apps for you. Open PushUS from your home screen
                {knownInstalled ? ' (you already added it)' : ''} for reliable reminders and full-screen
                logging.
              </>
            ) : (
              <>
                Chrome cannot switch to the installed app from this tab. The home screen icon is the
                reliable way to open PushUS.
              </>
            )}
          </p>
        </div>
      </div>

      {isIos ? (
        <HomeScreenSteps compact />
      ) : (
        <HomeScreenSteps />
      )}

      <div className="mt-4 flex flex-col gap-2">
        <Button className={dockPromptPrimaryButtonClass} onClick={acknowledgeOpenInApp}>
          {isIos ? 'Got it' : "Got it — I'll use the home screen icon"}
        </Button>
        {canTryOpenInApp ? (
          <Button
            variant="secondary"
            className={dockPromptSecondaryButtonClass}
            onClick={handleTryOpenInApp}
          >
            Try open in app anyway
          </Button>
        ) : null}
        <Button variant="ghost" className="min-h-10 w-full text-xs text-text-muted" onClick={dismissPermanently}>
          Don&apos;t remind me again
        </Button>
      </div>
    </BottomDockPrompt>
  )
}
