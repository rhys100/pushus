import { Button } from '@/components/ui'
import { usePwaInstallPrompt } from '@/hooks/usePwaInstallPrompt'
import { cn } from '@/lib/cn'

const TAB_NAV_PATHS = ['/leaderboard', '/activity', '/group', '/settings'] as const

function promptBottomClass(pathname: string): string {
  if (TAB_NAV_PATHS.some((path) => pathname.startsWith(path))) {
    return 'bottom-[var(--bottom-nav-height)]'
  }

  return 'bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]'
}

export function PwaInstallPrompt() {
  const { visible, installing, platform, install, dismiss, pathname } = usePwaInstallPrompt()

  if (!visible) {
    return null
  }

  const isIos = platform === 'ios'

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-40',
        promptBottomClass(pathname),
      )}
      role="region"
      aria-label="Install PushUS prompt"
    >
      <div className="dock-scrim" aria-hidden="true" />
      <div className="dock-panel px-4 pb-3 pt-3">
        <p className="text-sm font-semibold text-text-primary">
          Install PushUS for reliable reminders
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {isIos
            ? 'On iPhone, tap Share, then Add to Home Screen. PushUS opens like an app and keeps reminders more reliable.'
            : 'Android keeps installed web apps awake for reminders, even when Chrome quietens normal website notifications.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button loading={installing} onClick={() => void install()}>
            {isIos ? 'Got it' : 'Install PushUS'}
          </Button>
          <Button variant="secondary" disabled={installing} onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
