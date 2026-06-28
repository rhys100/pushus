import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button, Card } from '@/components/ui'
import { appConfig } from '@/lib/config'
import { useAuth } from '@/providers/AuthProvider'
import { useProfile } from '@/hooks/useProfile'
import type { ReminderIntervalHours } from '@/lib/notificationEligibility'
import { useNotificationPreferences } from '@/providers/NotificationPreferencesProvider'

function hourOptions() {
  return Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${String(hour).padStart(2, '0')}:00`,
  }))
}

const REMINDER_INTERVAL_OPTIONS: { value: ReminderIntervalHours; label: string }[] = [
  { value: 1, label: 'Every hour' },
  { value: 2, label: 'Every 2 hours' },
  { value: 24, label: 'Once per day' },
]

export function SettingsPage() {
  const { signOut } = useAuth()
  const { profile } = useProfile()
  const {
    prefs,
    loading: prefsLoading,
    saving,
    registering,
    error: prefsError,
    updatePreferences,
    enablePush,
    disablePush,
    pushSupport,
    pushPermission,
  } = useNotificationPreferences()

  const [localError, setLocalError] = useState<string | null>(null)
  const hours = hourOptions()
  const pushConfigured = pushSupport === 'supported'
  const displayError = localError ?? prefsError

  function pushButtonLabel(): string {
    if (prefs?.push_enabled) return 'Turn off'
    if (pushPermission === 'granted') return 'Enable reminders'
    if (pushPermission === 'denied') return 'Blocked'
    return 'Allow notifications'
  }

  async function handleTogglePush() {
    setLocalError(null)

    if (prefs?.push_enabled) {
      await disablePush()
      return
    }

    await enablePush()
  }

  async function handleHoursChange(field: 'active_hours_start' | 'active_hours_end', value: number) {
    setLocalError(null)
    await updatePreferences({ [field]: value })
  }

  async function handleIntervalChange(value: ReminderIntervalHours) {
    setLocalError(null)
    await updatePreferences({ reminder_interval_hours: value })
  }

  async function handleInjuryToggle(checked: boolean) {
    setLocalError(null)
    await updatePreferences({
      injury_paused: checked,
      injury_paused_until: checked ? prefs?.injury_paused_until : null,
    })
  }

  return (
    <AppLayout title="Settings" showNav={false}>
      <div className="space-y-4">
        <Card padding="md" className="space-y-3">
          <p className="text-sm font-medium text-text-primary">Profile</p>
          {profile ? (
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg text-2xl">
                {profile.avatar_emoji}
              </span>
              <div>
                <p className="font-semibold text-text-primary">{profile.display_name}</p>
                <p className="text-xs text-text-muted">{profile.timezone}</p>
              </div>
            </div>
          ) : null}
        </Card>

        <Card padding="md" className="space-y-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Push reminders</p>
            <p className="mt-1 text-xs text-text-muted">
              Reminders when you are behind your daily goal during your chosen hours and frequency.
              Beta — reminders may be delayed.
            </p>
          </div>

          {prefsLoading ? (
            <p className="text-sm text-text-muted">Loading notification settings…</p>
          ) : (
            <>
              {!pushConfigured ? (
                <p className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-xs text-text-muted">
                  {pushSupport === 'unsupported'
                    ? 'This browser does not support web push.'
                    : 'Push is not configured on this deployment yet.'}
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-text-primary">Daily reminders</p>
                      <p className="text-xs text-text-muted">
                        Permission:{' '}
                        {pushPermission === 'unsupported'
                          ? 'n/a'
                          : pushPermission === 'granted'
                            ? 'granted'
                            : pushPermission === 'denied'
                              ? 'blocked — allow in browser settings'
                              : pushPermission}
                      </p>
                      <p className="text-xs text-text-muted">
                        Reminders: {prefs?.push_enabled ? 'on' : 'off'}
                      </p>
                    </div>
                    <Button
                      variant={prefs?.push_enabled ? 'secondary' : 'primary'}
                      loading={registering || saving}
                      disabled={
                        !pushConfigured || (pushPermission === 'denied' && !prefs?.push_enabled)
                      }
                      onClick={() => void handleTogglePush()}
                    >
                      {pushButtonLabel()}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-text-muted">From</span>
                      <select
                        className="w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                        value={prefs?.active_hours_start ?? 7}
                        disabled={!prefs?.push_enabled || saving}
                        onChange={(event) =>
                          void handleHoursChange('active_hours_start', Number(event.target.value))
                        }
                      >
                        {hours.map((hour) => (
                          <option key={`start-${hour.value}`} value={hour.value}>
                            {hour.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-medium text-text-muted">Until</span>
                      <select
                        className="w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                        value={prefs?.active_hours_end ?? 20}
                        disabled={!prefs?.push_enabled || saving}
                        onChange={(event) =>
                          void handleHoursChange('active_hours_end', Number(event.target.value))
                        }
                      >
                        {hours.map((hour) => (
                          <option key={`end-${hour.value}`} value={hour.value}>
                            {hour.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="space-y-1">
                    <span className="text-xs font-medium text-text-muted">Frequency</span>
                    <select
                      className="w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                      value={prefs?.reminder_interval_hours ?? 1}
                      disabled={!prefs?.push_enabled || saving}
                      onChange={(event) =>
                        void handleIntervalChange(Number(event.target.value) as ReminderIntervalHours)
                      }
                    >
                      {REMINDER_INTERVAL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                      checked={prefs?.injury_paused ?? false}
                      disabled={saving}
                      onChange={(event) => void handleInjuryToggle(event.target.checked)}
                    />
                    <span>
                      <span className="block text-sm text-text-primary">Injury pause</span>
                      <span className="block text-xs text-text-muted">
                        Pause reminders while you recover. Logging still works.
                      </span>
                    </span>
                  </label>

                  <p className="text-xs text-text-muted">
                    Daily target: {prefs?.daily_target ?? 20} push-ups (from your training plan).
                  </p>
                </div>
              )}

              {displayError ? (
                <p className="text-xs text-danger" role="alert">
                  {displayError}
                </p>
              ) : null}
            </>
          )}
        </Card>

        <Card padding="md" className="space-y-2">
          <Link
            to="/about"
            className="flex min-h-11 items-center justify-between text-sm text-text-primary hover:text-accent"
          >
            About {appConfig.name}
            <span aria-hidden="true">→</span>
          </Link>
        </Card>

        <Button variant="danger" fullWidth onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </AppLayout>
  )
}
