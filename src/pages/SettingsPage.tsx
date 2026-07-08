import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, useToast } from '@/components/ui'
import { AvailabilitySettings } from '@/components/settings/AvailabilitySettings'
import { BoardPrivacySettings } from '@/components/settings/BoardPrivacySettings'
import { CustomActivitiesSettings } from '@/components/settings/CustomActivitiesSettings'
import { GroupAdminSettings } from '@/components/settings/GroupAdminSettings'
import { SettingsLinkRow } from '@/components/settings/SettingsLinkRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { APP_VERSION } from '@/lib/appVersionLabel'
import { useTabPageMeta } from '@/components/layout/TabPageMeta'
import { appConfig } from '@/lib/config'
import { AVATAR_EMOJIS } from '@/lib/emojis'
import { cn } from '@/lib/cn'
import { noticeBannerClass, noticeInlineClass } from '@/lib/noticeStyles'
import { formatProfileName } from '@/lib/memberDisplayName'
import { supabase } from '@/lib/supabase'
import { timezoneOptions } from '@/lib/timezones'
import { useAuth } from '@/providers/AuthProvider'
import { useProfile } from '@/hooks/useProfile'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'
import { capPlanMaxUpdate } from '@/lib/training/maxCleanUpdate'
import { formatDayTargetSetsDetail, dayOfWeekFromIso } from '@/lib/training/planEngine'
import { getGroupLocalDateString } from '@/hooks/useTodayData'
import type { ReminderIntervalMinutes } from '@/lib/notificationEligibility'
import {
  getStoredThemePreference,
  setThemePreference,
  type ThemePreference,
} from '@/lib/theme'
import { useNotificationPreferences } from '@/providers/NotificationPreferencesProvider'
import { getErrorMessage } from '@/lib/errors'
import { getPwaInstallHintForPush, isStandalonePwa } from '@/lib/pwa'
import { openInstalledPwa } from '@/lib/pwaOpenInApp'
import { readPwaInstallPlatform } from '@/lib/pwaInstallStatus'
import {
  isPwaOpenAppPromptDismissed,
  resetPwaOpenAppPromptReminders,
} from '@/lib/storage'

function hourOptions() {
  return Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${String(hour).padStart(2, '0')}:00`,
  }))
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const REMINDER_INTERVAL_OPTIONS: { value: ReminderIntervalMinutes; label: string }[] = [
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 180, label: 'Every 3 hours' },
  { value: 240, label: 'Every 4 hours' },
  { value: 1440, label: 'Once per day' },
]

type SettingsLocationState = {
  planSaved?: boolean
  peakDay?: number
}

export function SettingsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, user, refreshProfile } = useAuth()
  const { profile } = useProfile()
  const { activeGroup, role } = useActiveGroup()
  const { toast } = useToast()
  const isAdmin = role === 'owner' || role === 'admin'
  const planTimezone = profile?.timezone || activeGroup?.timezone || 'UTC'
  const {
    dailyTarget,
    todayPrescription,
    weeklySchedule,
    peakDayTarget,
    wizardCompleted,
    hasPlan,
    plan,
    confirmPendingMaxClean,
    dismissPendingMaxClean,
    confirmingMaxClean,
  } = useTrainingPlan(user?.id, activeGroup?.id, planTimezone)
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
    installStatus,
    refresh: refreshPrefs,
  } = useNotificationPreferences()

  const [localError, setLocalError] = useState<string | null>(null)
  const [planSavedMessage, setPlanSavedMessage] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    getStoredThemePreference(),
  )
  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [profileInitial, setProfileInitial] = useState('')
  const [profileEmoji, setProfileEmoji] = useState<string>(AVATAR_EMOJIS[0])
  const [profileTimezone, setProfileTimezone] = useState('UTC')
  const [savingProfile, setSavingProfile] = useState(false)
  const [openAppPromptDismissed, setOpenAppPromptDismissed] = useState(false)
  const hours = hourOptions()
  const pushPlatform = readPwaInstallPlatform()
  const inBrowserTab = !isStandalonePwa()
  const needsPwaInstall = pushSupport === 'needs_pwa_install'
  const canOpenInstalledApp = installStatus?.isOpenAppEligible ?? false
  const pushUnavailable =
    pushSupport === 'unsupported' || pushSupport === 'missing_vapid_key'
  const displayError = localError ?? prefsError
  const isRestDay = hasPlan && (todayPrescription?.isRestDay || dailyTarget === 0)
  const pendingMax = plan?.pending_max_clean_update
  const cappedMax =
    pendingMax && plan?.max_clean_set
      ? capPlanMaxUpdate(plan.max_clean_set, pendingMax)
      : null
  const todayDayIndex = dayOfWeekFromIso(getGroupLocalDateString(planTimezone), planTimezone)

  const reminderIntervalMinutes = prefs?.reminder_interval_minutes ?? 60
  const reminderFreqLabel =
    REMINDER_INTERVAL_OPTIONS.find((option) => option.value === reminderIntervalMinutes)?.label ??
    'Every hour'
  const activeHoursLabel = `${String(prefs?.active_hours_start ?? 7).padStart(2, '0')}:00–${String(
    prefs?.active_hours_end ?? 20,
  ).padStart(2, '0')}:00`

  // One plain-language line under the reminders toggle — no dev-speak.
  function reminderStatusLine(): string {
    if (prefs?.push_enabled) {
      return `On · ${reminderFreqLabel.toLowerCase()}, ${activeHoursLabel}`
    }
    if (pushPermission === 'denied') {
      return 'Blocked — allow notifications in your browser settings'
    }
    if (needsPwaInstall) {
      return 'Add PushUS to your home screen to turn these on'
    }
    return 'Off'
  }

  async function handleConfirmMaxClean() {
    try {
      await confirmPendingMaxClean()
      toast({ message: 'Training plan max clean updated.', variant: 'success' })
    } catch (error) {
      toast({
        message: getErrorMessage(error, 'Could not update max clean.'),
        variant: 'danger',
      })
    }
  }

  async function handleDismissMaxClean() {
    try {
      await dismissPendingMaxClean()
    } catch (error) {
      toast({
        message: getErrorMessage(error, 'Could not dismiss update.'),
        variant: 'danger',
      })
    }
  }

  useTabPageMeta({
    title: 'Settings',
    subtitle: 'Personal and group options',
  })

  useEffect(() => {
    if (!user?.id) {
      setOpenAppPromptDismissed(false)
      return
    }

    const syncOpenAppDismiss = () => {
      setOpenAppPromptDismissed(isPwaOpenAppPromptDismissed(user.id))
    }

    syncOpenAppDismiss()
    window.addEventListener('pushus:pwa-open-app-recheck', syncOpenAppDismiss)
    return () => window.removeEventListener('pushus:pwa-open-app-recheck', syncOpenAppDismiss)
  }, [user?.id])

  useEffect(() => {
    if (!profile) return
    setProfileDisplayName(profile.display_name)
    setProfileInitial(profile.name_initial ?? '')
    setProfileEmoji(profile.avatar_emoji)
    setProfileTimezone(profile.timezone || 'UTC')
  }, [profile])

  useEffect(() => {
    const state = location.state as SettingsLocationState | null
    if (!state?.planSaved || state.peakDay == null) {
      return
    }

    setPlanSavedMessage(
      `Training plan saved — peak day ${state.peakDay} reps. Your 4-week build starts now.`,
    )
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  function pushButtonLabel(): string {
    if (prefs?.push_enabled) return 'Turn off'
    if (needsPwaInstall && canOpenInstalledApp) return 'Open in app'
    if (needsPwaInstall) return 'Install app to enable'
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

    if (needsPwaInstall && canOpenInstalledApp) {
      if (user?.id) {
        resetPwaOpenAppPromptReminders(user.id)
        setOpenAppPromptDismissed(false)
      }
      openInstalledPwa(location.pathname, window.location.origin)
      return
    }

    await enablePush()
  }

  function handleResetOpenAppReminders() {
    if (!user?.id) {
      return
    }

    resetPwaOpenAppPromptReminders(user.id)
    setOpenAppPromptDismissed(false)
    toast({ message: 'Open-in-app reminder restored.', variant: 'success' })
  }

  async function handleHoursChange(field: 'active_hours_start' | 'active_hours_end', value: number) {
    setLocalError(null)
    await updatePreferences({ [field]: value })
  }

  function handleThemeChange(value: ThemePreference) {
    setThemePreferenceState(value)
    setThemePreference(value)
  }

  async function handleIntervalChange(value: ReminderIntervalMinutes) {
    setLocalError(null)
    await updatePreferences({ reminder_interval_minutes: value })
  }

  async function handleSaveProfile() {
    const trimmed = profileDisplayName.trim()
    if (!trimmed) {
      toast({ message: 'Display name is required.', variant: 'danger' })
      return
    }

    setSavingProfile(true)
    const { error } = await supabase.rpc('update_my_profile', {
      p_display_name: trimmed,
      p_avatar_emoji: profileEmoji,
      p_timezone: profileTimezone,
      p_name_initial: profileInitial.trim() || null,
    })
    setSavingProfile(false)

    if (error) {
      toast({ message: error.message, variant: 'danger' })
      return
    }

    await refreshProfile()
    setEditingProfile(false)
    toast({ message: 'Profile updated.', variant: 'success' })
  }

  return (
    <div className="space-y-6 pb-4">
      {planSavedMessage ? (
        <div
          role="status"
          className={cn(noticeBannerClass('success'), 'flex items-start gap-3')}
        >
          <p className="flex-1 text-sm leading-snug text-text-primary">{planSavedMessage}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setPlanSavedMessage(null)}
            className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
          >
            ×
          </button>
        </div>
      ) : null}

      <SettingsSection title="Account">
      <Card padding="md" className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Profile</p>
        {profile && !editingProfile ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bg text-2xl">
                {profile.avatar_emoji}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary">
                  {formatProfileName(profile)}
                </p>
                <p className="truncate text-xs text-text-muted">{profile.timezone}</p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="min-h-9 shrink-0 px-3 text-sm"
              onClick={() => setEditingProfile(true)}
            >
              Edit
            </Button>
          </div>
        ) : profile ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="settingsDisplayName" className="text-xs font-medium text-text-muted">
                Display name
              </label>
              <input
                id="settingsDisplayName"
                type="text"
                maxLength={40}
                value={profileDisplayName}
                onChange={(event) => setProfileDisplayName(event.target.value)}
                className={cn(
                  'w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5',
                  'text-sm text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settingsNameInitial" className="text-xs font-medium text-text-muted">
                Initial (optional)
              </label>
              <input
                id="settingsNameInitial"
                type="text"
                maxLength={1}
                value={profileInitial}
                onChange={(event) =>
                  setProfileInitial(event.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1))
                }
                className={cn(
                  'w-20 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5',
                  'text-sm text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                )}
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-text-muted">Avatar emoji</span>
              <div className="grid grid-cols-8 gap-2">
                {AVATAR_EMOJIS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-label={`Select ${option}`}
                    aria-pressed={profileEmoji === option}
                    onClick={() => setProfileEmoji(option)}
                    className={cn(
                      'flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] text-xl',
                      'border transition-colors',
                      profileEmoji === option
                        ? 'border-accent bg-accent-muted'
                        : 'border-border bg-bg hover:border-accent/30',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settingsTimezone" className="text-xs font-medium text-text-muted">
                Timezone
              </label>
              <select
                id="settingsTimezone"
                value={profileTimezone}
                onChange={(event) => setProfileTimezone(event.target.value)}
                className={cn(
                  'w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5',
                  'text-sm text-text-primary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                )}
              >
                {timezoneOptions().map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                className="min-h-10 flex-1"
                loading={savingProfile}
                onClick={() => void handleSaveProfile()}
              >
                Save profile
              </Button>
              <Button
                variant="secondary"
                className="min-h-10 flex-1"
                disabled={savingProfile}
                onClick={() => {
                  if (profile) {
                    setProfileDisplayName(profile.display_name)
                    setProfileInitial(profile.name_initial ?? '')
                    setProfileEmoji(profile.avatar_emoji)
                    setProfileTimezone(profile.timezone || 'UTC')
                  }
                  setEditingProfile(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
      </SettingsSection>

      <SettingsSection title="Preferences">
      <Card padding="md" className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Appearance</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={themePreference === option.value}
              onClick={() => handleThemeChange(option.value)}
              className={cn(
                'min-h-11 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors',
                themePreference === option.value
                  ? 'border-accent bg-accent-muted text-text-primary'
                  : 'border-border bg-bg text-text-muted hover:border-accent/30',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          System follows your phone&apos;s light/dark setting.
        </p>
      </Card>

      <CustomActivitiesSettings />

      <BoardPrivacySettings />
      </SettingsSection>

      <SettingsSection title="Training">
      <Card padding="md" className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Training plan</p>
        {hasPlan ? (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5">
            <div>
              <p className="text-xs text-text-muted">
                {isRestDay ? 'Today' : "Today's target"}
              </p>
              <p className="text-sm font-semibold text-text-primary">
                {isRestDay ? (
                  'Rest day'
                ) : dailyTarget != null ? (
                  <>
                    {dailyTarget}
                    <span className="ml-1 text-xs font-medium text-text-muted">push-ups</span>
                  </>
                ) : (
                  '—'
                )}
              </p>
              {hasPlan && !isRestDay && todayPrescription && todayPrescription.sets > 0 ? (
                <p className="mt-0.5 text-xs text-text-muted">
                  {formatDayTargetSetsDetail(todayPrescription)}
                </p>
              ) : null}
            </div>
            {wizardCompleted ? (
              <div className="shrink-0 text-right text-xs text-text-muted">
                <p>Week {todayPrescription?.mesocycleWeek ?? 1} of 4</p>
                <p>Max clean {plan?.max_clean_set}</p>
                <p>Peak {peakDayTarget}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-text-muted">
            A science-based 4-week build with rest, easy, moderate, and challenge days — set your
            max clean and training days to get personalised targets.
          </p>
        )}
        {pendingMax && plan?.max_clean_set && cappedMax ? (
          <div className={cn(noticeInlineClass('accent'), 'px-3 py-3 text-sm')}>
            <p className="text-sm font-medium text-text-primary">Max clean check-in</p>
            <p className="mt-1 text-xs text-text-muted">
              You logged {pendingMax} in one set. Apply a capped update to {cappedMax} (plan max{' '}
              {plan.max_clean_set})?
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                className="min-h-9 px-3 text-sm"
                loading={confirmingMaxClean}
                onClick={() => void handleConfirmMaxClean()}
              >
                Update to {cappedMax}
              </Button>
              <Button
                className="min-h-9 px-3 text-sm"
                variant="secondary"
                onClick={() => void handleDismissMaxClean()}
              >
                Not now
              </Button>
            </div>
          </div>
        ) : null}
        {wizardCompleted && weeklySchedule ? (
          <div className="grid grid-cols-7 gap-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => {
              const day = weeklySchedule[index as 0 | 1 | 2 | 3 | 4 | 5 | 6]
              const isToday = todayDayIndex === index
              return (
                <div
                  key={`${label}-${index}`}
                  className={cn(
                    'flex flex-col items-center rounded-[var(--radius-sm)] border bg-bg px-1 py-1.5 text-center',
                    isToday ? 'border-accent/60 ring-1 ring-accent/25' : 'border-border',
                  )}
                >
                  <span
                    className={cn(
                      'text-[10px] font-medium',
                      isToday ? 'text-accent' : 'text-text-muted',
                    )}
                  >
                    {label}
                  </span>
                  <span className="font-mono text-xs font-semibold text-text-primary">
                    {day.target > 0 ? day.target : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : null}
        <SettingsLinkRow
          to="/settings/training"
          title={wizardCompleted ? 'Update training plan' : 'Set up training plan'}
          description="Max set, training days, and your 4-week build"
        />
      </Card>

      <AvailabilitySettings onChanged={() => void refreshPrefs()} />
      </SettingsSection>

      <SettingsSection title="Notifications">
      <Card padding="md" className="space-y-4">
        <div>
          <p className="text-sm font-medium text-text-primary">Push reminders</p>
          <p className="mt-1 text-xs text-text-muted">
            A nudge when you&apos;re behind your daily goal, during your chosen hours.
          </p>
        </div>

        {prefsLoading ? (
          <p className="text-sm text-text-muted">Loading notification settings…</p>
        ) : (
          <>
            {pushUnavailable ? (
              <p className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-xs text-text-muted">
                {pushSupport === 'unsupported'
                  ? 'This browser does not support web push.'
                  : 'Push is not configured on this deployment yet.'}
              </p>
            ) : (
              <div className="space-y-3">
                {needsPwaInstall ? (
                  <p className={cn(noticeInlineClass('accent'), 'text-text-muted')}>
                    {canOpenInstalledApp
                      ? 'Reminders only work in the installed home-screen app. Tap Open in app, then turn on reminders there.'
                      : getPwaInstallHintForPush(pushPlatform)}
                  </p>
                ) : null}

                {inBrowserTab && canOpenInstalledApp && openAppPromptDismissed ? (
                  <p className="text-xs text-text-muted">
                    Open-in-app reminder hidden.{' '}
                    <button
                      type="button"
                      className="font-medium text-accent underline underline-offset-2"
                      onClick={handleResetOpenAppReminders}
                    >
                      Show it again
                    </button>
                  </p>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">Reminders</p>
                    <p className="text-xs text-text-muted">{reminderStatusLine()}</p>
                  </div>
                  <Button
                    variant={prefs?.push_enabled ? 'secondary' : 'primary'}
                    className="shrink-0"
                    loading={registering || saving}
                    disabled={pushPermission === 'denied' && !prefs?.push_enabled}
                    onClick={() => void handleTogglePush()}
                  >
                    {pushButtonLabel()}
                  </Button>
                </div>

                {prefs?.push_enabled ? (
                  <div className="space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-text-muted">From</span>
                        <select
                          className="w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                          value={prefs?.active_hours_start ?? 7}
                          disabled={saving}
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
                          disabled={saving}
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
                        value={prefs?.reminder_interval_minutes ?? 60}
                        disabled={saving}
                        onChange={(event) =>
                          void handleIntervalChange(
                            Number(event.target.value) as ReminderIntervalMinutes,
                          )
                        }
                      >
                        {REMINDER_INTERVAL_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <p className="text-xs text-text-muted">
                      Injured or taking a break? Set your status under{' '}
                      <span className="font-medium text-text-primary">Availability</span> above — it
                      pauses reminders and your plan and protects your streak.
                    </p>
                  </div>
                ) : null}
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
      </SettingsSection>

      {isAdmin ? (
        <SettingsSection title="Group tools">
          <GroupAdminSettings />
        </SettingsSection>
      ) : null}

      <SettingsSection title="About">
        <Card padding="md" className="space-y-1">
          <SettingsLinkRow
            to="/settings/whats-new"
            title="What's new"
            description="Feature launches and release notes"
          />
          <SettingsLinkRow to="/about" title={`About ${appConfig.name}`} />
        </Card>

        <Button variant="danger" fullWidth onClick={() => void signOut()}>
          Sign out
        </Button>

        <p className="text-center text-xs text-text-muted">
          {appConfig.name} v{APP_VERSION}
        </p>
      </SettingsSection>
    </div>
  )
}
