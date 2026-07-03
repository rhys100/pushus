import { Button } from '@/components/ui'
import {
  BottomDockPrompt,
  dockPromptPrimaryButtonClass,
  dockPromptSecondaryButtonClass,
} from '@/components/BottomDockPrompt'
import { getPwaInstallHintForPush } from '@/lib/pwa'
import { readPwaInstallPlatform } from '@/lib/pwaInstallStatus'
import { usePushNotificationPrompt } from '@/hooks/usePushNotificationPrompt'
import { useNotificationPreferences } from '@/providers/NotificationPreferencesProvider'

export function PushNotificationPrompt() {
  const { visible, enabling, error, enable, dismiss, pathname } = usePushNotificationPrompt()
  const { pushSupport } = useNotificationPreferences()
  const needsPwaInstall = pushSupport === 'needs_pwa_install'
  const platform = readPwaInstallPlatform()

  if (!visible) {
    return null
  }

  return (
    <BottomDockPrompt ariaLabel="Push reminder prompt" pathname={pathname}>
      <p className="text-sm font-semibold text-text-primary">Stay on track with push reminders</p>
      {needsPwaInstall ? (
        <p className="mt-1 text-sm leading-snug text-text-muted">
          {getPwaInstallHintForPush(platform)}
        </p>
      ) : (
        <p className="mt-1 text-sm leading-snug text-text-muted">
          We send hourly reminders if you are behind your goal, between 7am and 7pm in your
          timezone. Change hours, frequency, or pause in Settings.
        </p>
      )}
      {error ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {needsPwaInstall ? (
          <Button
            variant="secondary"
            className={dockPromptSecondaryButtonClass}
            onClick={dismiss}
          >
            Got it
          </Button>
        ) : (
          <>
            <Button
              loading={enabling}
              className={dockPromptPrimaryButtonClass}
              onClick={() => void enable()}
            >
              Enable reminders
            </Button>
            <Button
              variant="secondary"
              className={dockPromptSecondaryButtonClass}
              disabled={enabling}
              onClick={dismiss}
            >
              Not now
            </Button>
          </>
        )}
      </div>
    </BottomDockPrompt>
  )
}
