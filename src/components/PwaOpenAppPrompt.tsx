import { Button } from '@/components/ui'
import {
  BottomDockPrompt,
  dockPromptSecondaryButtonClass,
} from '@/components/BottomDockPrompt'
import { usePwaOpenAppPrompt } from '@/hooks/usePwaOpenAppPrompt'
import { canTryOpenInInstalledApp, openInstalledPwa } from '@/lib/pwaOpenInApp'

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
    openInstalledPwa()
  }

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
            Tap <span className="font-medium text-text-primary">Open in app</span>. If Chrome asks,
            choose PushUS. If nothing happens, open PushUS once from your home screen to update it,
            then try again.
          </>
        )}
      </p>
      {isIos ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-snug text-text-muted">
          <li>Leave this Safari tab or press the home button.</li>
          <li>Tap the PushUS icon on your home screen.</li>
        </ol>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {canTryOpenInApp ? (
          <Button onClick={handleOpenInApp}>Open in app</Button>
        ) : (
          <Button onClick={acknowledgeOpenInApp}>OK, I&apos;ll use the home screen icon</Button>
        )}
        <Button variant="secondary" className={dockPromptSecondaryButtonClass} onClick={dismissPermanently}>
          Don&apos;t remind me again
        </Button>
      </div>
    </BottomDockPrompt>
  )
}
