import { Button } from '@/components/ui'
import { usePwaOpenAppPrompt } from '@/hooks/usePwaOpenAppPrompt'
import { cn } from '@/lib/cn'

const TAB_NAV_PATHS = ['/leaderboard', '/activity', '/group', '/settings'] as const

function promptBottomClass(pathname: string): string {
  if (TAB_NAV_PATHS.some((path) => pathname.startsWith(path))) {
    return 'bottom-[var(--bottom-nav-height)]'
  }

  return 'bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]'
}

export function PwaOpenAppPrompt() {
  const { visible, confidence, platform, dismiss, pathname } = usePwaOpenAppPrompt()

  if (!visible) {
    return null
  }

  const isIos = platform === 'ios'
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
          Open PushUS from your home screen
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {isIos
            ? knownInstalled
              ? 'You have PushUS on your home screen. Open that icon for reliable reminders — this Safari tab cannot replace the installed app.'
              : 'If you added PushUS to your home screen, open that icon for reliable reminders — this Safari tab cannot replace the installed app.'
            : knownInstalled
              ? 'PushUS is installed on this phone. Open it from your home screen or app drawer for reliable reminders.'
              : 'If you installed PushUS on this phone, open it from your home screen or app drawer for reliable reminders.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={dismiss}>Got it</Button>
          <Button variant="secondary" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
