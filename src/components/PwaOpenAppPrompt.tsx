import { Button } from '@/components/ui'
import {
  BottomDockPrompt,
  dockPromptPrimaryButtonClass,
  dockPromptSecondaryButtonClass,
} from '@/components/BottomDockPrompt'
import { usePwaOpenAppPrompt } from '@/hooks/usePwaOpenAppPrompt'
import { canTryOpenInInstalledApp, openInstalledPwa } from '@/lib/pwaOpenInApp'

function IosHomeScreenSteps() {
  return (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-snug text-text-muted">
      <li>Leave this Safari tab or press the home button.</li>
      <li>Tap the PushUS icon on your home screen.</li>
    </ol>
  )
}

export function PwaOpenAppPrompt() {
  const { visible, confidence, platform, dismissPermanently, acknowledgeOpenInApp, pathname } =
    usePwaOpenAppPrompt()

  if (!visible) {
    return null
  }

  const isIos = platform === 'ios'
  const canTryOpenInApp = canTryOpenInInstalledApp(platform)
  const knownInstalled = confidence === 'known'

  const handleOpenInApp = () => {
    acknowledgeOpenInApp()
    openInstalledPwa(pathname, window.location.origin)
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
            {isIos ? 'Use the PushUS home screen app' : 'Open PushUS in the installed app'}
          </p>
          <p className="mt-1 text-sm leading-snug text-text-muted">
            {isIos ? (
              <>
                Safari cannot switch apps for you. Open PushUS from your home screen
                {knownInstalled ? ' (you already added it)' : ''} for reliable reminders and
                full-screen logging.
              </>
            ) : (
              <>
                Tap <span className="font-medium text-text-primary">Open in app</span> to switch to
                your installed PushUS. If nothing happens, open it from your home screen icon
                instead.
              </>
            )}
          </p>
        </div>
      </div>

      {isIos ? <IosHomeScreenSteps /> : null}

      <div className="mt-4 flex flex-col gap-2">
        {canTryOpenInApp ? (
          <Button className={dockPromptPrimaryButtonClass} onClick={handleOpenInApp}>
            Open in app
          </Button>
        ) : (
          <Button className={dockPromptPrimaryButtonClass} onClick={acknowledgeOpenInApp}>
            Got it
          </Button>
        )}
        <Button
          variant="secondary"
          className={dockPromptSecondaryButtonClass}
          onClick={dismissPermanently}
        >
          Don&apos;t remind me again
        </Button>
      </div>
    </BottomDockPrompt>
  )
}
