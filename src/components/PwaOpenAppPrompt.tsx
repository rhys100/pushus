import { Button, ButtonLink } from '@/components/ui'
import {
  BottomDockPrompt,
  dockPromptPrimaryButtonClass,
  dockPromptSecondaryButtonClass,
} from '@/components/BottomDockPrompt'
import { usePwaOpenAppPrompt } from '@/hooks/usePwaOpenAppPrompt'
import { buildPwaOpenInAppUrl, canTryOpenInInstalledApp } from '@/lib/pwaOpenInApp'

export function PwaOpenAppPrompt() {
  const { visible, confidence, platform, dismissPermanently, acknowledgeOpenInApp, pathname } =
    usePwaOpenAppPrompt()

  if (!visible) {
    return null
  }

  const isIos = platform === 'ios'
  const canTryOpenInApp = canTryOpenInInstalledApp(platform)
  const knownInstalled = confidence === 'known'
  const openAppUrl =
    typeof window !== 'undefined'
      ? buildPwaOpenInAppUrl(pathname, window.location.origin)
      : buildPwaOpenInAppUrl(pathname)

  return (
    <BottomDockPrompt ariaLabel="Open installed PushUS prompt" pathname={pathname}>
      <p className="text-sm font-semibold text-text-primary">
        {isIos ? 'Use the PushUS home screen app' : 'Open PushUS in the installed app'}
      </p>
      <p className="mt-1 text-sm leading-snug text-text-muted">
        {isIos ? (
          <>
            Safari cannot switch to the home screen app for you. Go to your home screen and tap
            the PushUS icon
            {knownInstalled ? ' you already added' : ''} for reliable reminders.
          </>
        ) : (
          <>
            Tap <span className="font-medium text-text-primary">Open in app</span> below. Android
            should switch to your installed PushUS. If Chrome stays in the browser, use the
            home screen icon instead.
          </>
        )}
      </p>
      {isIos ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-snug text-text-muted">
          <li>Leave this Safari tab or press the home button.</li>
          <li>Tap the PushUS icon on your home screen.</li>
        </ol>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canTryOpenInApp ? (
          <ButtonLink
            href={openAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={dockPromptPrimaryButtonClass}
            onClick={acknowledgeOpenInApp}
          >
            Open in app
          </ButtonLink>
        ) : (
          <Button className={dockPromptPrimaryButtonClass} onClick={acknowledgeOpenInApp}>
            OK, I&apos;ll use the home screen icon
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
