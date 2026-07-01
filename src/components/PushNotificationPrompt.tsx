import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { getIosPwaInstallHint } from '@/lib/pwa'
import { usePushNotificationPrompt } from '@/hooks/usePushNotificationPrompt'
import { useNotificationPreferences } from '@/providers/NotificationPreferencesProvider'

const TAB_NAV_PATHS = ['/leaderboard', '/activity', '/group', '/settings'] as const

function promptBottomClass(pathname: string): string {
  if (TAB_NAV_PATHS.some((path) => pathname.startsWith(path))) {
    return 'bottom-[var(--bottom-nav-height)]'
  }

  return 'bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]'
}

export function PushNotificationPrompt() {
  const { visible, enabling, error, enable, dismiss, pathname } = usePushNotificationPrompt()
  const { pushSupport } = useNotificationPreferences()
  const needsIosInstall = pushSupport === 'ios_needs_install'

  if (!visible) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-40',
        promptBottomClass(pathname),
      )}
      role="region"
      aria-label="Push reminder prompt"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel px-4 pb-3 pt-3">
      <p className="text-sm font-semibold text-text-primary">Stay on track with push reminders</p>
      {needsIosInstall ? (
        <p className="mt-1 text-sm text-text-muted">{getIosPwaInstallHint()}</p>
      ) : (
        <p className="mt-1 text-sm text-text-muted">
          We send hourly reminders if you are behind your goal, between 7am and 7pm in your
          timezone. Change hours, frequency, or pause in Settings.
        </p>
      )}
      {error ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {needsIosInstall ? (
          <Button variant="secondary" onClick={dismiss}>
            Got it
          </Button>
        ) : (
          <>
            <Button loading={enabling} onClick={() => void enable()}>
              Enable reminders
            </Button>
            <Button variant="secondary" disabled={enabling} onClick={dismiss}>
              Not now
            </Button>
          </>
        )}
      </div>
      </div>
    </div>
  )
}
