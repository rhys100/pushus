import { Button } from '@/components/ui'
import {
  BottomDockPrompt,
  dockPromptPrimaryButtonClass,
  dockPromptSecondaryButtonClass,
} from '@/components/BottomDockPrompt'
import { usePwaInstallPrompt } from '@/hooks/usePwaInstallPrompt'

export function PwaInstallPrompt() {
  const { visible, installing, platform, install, dismiss, pathname } = usePwaInstallPrompt()

  if (!visible) {
    return null
  }

  const isIos = platform === 'ios'

  return (
    <BottomDockPrompt ariaLabel="Install PushUS prompt" pathname={pathname}>
      <p className="text-sm font-semibold text-text-primary">Install PushUS for reliable reminders</p>
      <p className="mt-1 text-sm leading-snug text-text-muted">
        {isIos
          ? 'On iPhone, tap Share, then Add to Home Screen. PushUS opens like an app and keeps reminders more reliable.'
          : 'Android keeps installed web apps awake for reminders, even when Chrome quietens normal website notifications.'}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          loading={installing}
          className={dockPromptPrimaryButtonClass}
          onClick={() => void install()}
        >
          {isIos ? 'Got it' : 'Install PushUS'}
        </Button>
        <Button
          variant="secondary"
          className={dockPromptSecondaryButtonClass}
          disabled={installing}
          onClick={dismiss}
        >
          Not now
        </Button>
      </div>
    </BottomDockPrompt>
  )
}
