import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { usePushNotificationPrompt } from '@/hooks/usePushNotificationPrompt'

const TAB_NAV_PATHS = ['/leaderboard', '/activity', '/group', '/settings'] as const

function promptBottomClass(pathname: string): string {
  if (TAB_NAV_PATHS.some((path) => pathname.startsWith(path))) {
    return 'bottom-[var(--bottom-nav-height)]'
  }

  return 'bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]'
}

export function PushNotificationPrompt() {
  const { visible, enabling, error, enable, dismiss, pathname } = usePushNotificationPrompt()

  if (!visible) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 z-40 border-t border-border bg-surface px-4 pb-3 pt-3 shadow-[0_-4px_24px_rgba(0,0,0,0.12)]',
        promptBottomClass(pathname),
      )}
      role="region"
      aria-label="Push reminder prompt"
    >
      <p className="text-sm font-semibold text-text-primary">Stay on track with push reminders</p>
      <p className="mt-1 text-sm text-text-muted">
        We send hourly reminders if you are behind your goal, between 7am and 7pm in your
        timezone. Change hours, frequency, or pause in Settings.
      </p>
      {error ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button loading={enabling} onClick={() => void enable()}>
          Enable reminders
        </Button>
        <Button variant="secondary" disabled={enabling} onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  )
}
