import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, useToast } from '@/components/ui'
import { GroupAdminSettings } from '@/components/settings/GroupAdminSettings'
import { SettingsLinkRow } from '@/components/settings/SettingsLinkRow'
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
import type { ReminderIntervalHours } from '@/lib/notificationEligibility'
import { useNotificationPreferences } from '@/providers/NotificationPreferencesProvider'
import { getErrorMessage } from '@/lib/errors'
import { getPwaInstallHintForPush } from '@/lib/pwa'
import { readPwaInstallPlatform } from '@/lib/pwaInstallStatus'

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

type SettingsLocationState = {
  planSaved?: boolean
  peakDay?: number
}

export function SettingsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, user, refreshProfile } = useAuth()
  const { profile } = useProfile()
  const { activeGroup } = useActiveGroup()
  const { toast } = useToast()
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
  } = useNotificationPreferences()

  const [localError, setLocalError] = useState<string | null>(null)
  const [planSavedMessage, setPlanSavedMessage] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [profileInitial, setProfileInitial] = useState('')
  const [profileEmoji, setProfileEmoji] = useState<string>(AVATAR_EMOJIS[0])
  const [profileTimezone, setProfileTimezone] = useState('UTC')
  const [savingProfile, setSavingProfile] = useState(false)
  const hours = hourOptions()
  const pushPlatform = readPwaInstallPlatform()
  const pushReady = pushSupport === 'supported'
  const needsPwaInstall = pushSupport === 'needs_pwa_install'
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
    <div className="space-y-4 pb-4">
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

      <Card padding="md" className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Personal</p>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-text-primary">Profile</p>
          {profile && !editingProfile ? (
            <Button
              variant="secondary"
              className="min-h-9 shrink-0 px-3 text-sm"
              onClick={() => setEditingProfile(true)}
            >
              Edit
            </Button>
          ) : null}
        </div>
        {profile && !editingProfile ? (
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg text-2xl">
              {profile.avatar_emoji}
            </span>
            <div>
              <p className="font-semibold text-text-primary">
                {formatProfileName(profile)}
              </p>
              <p className="text-xs text-text-muted">{profile.timezone}</p>
            </div>
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

      <Card padding="md" className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Training plan</p>
        <p className="text-xs text-text-muted">
          Science-based weekly plan with rest, easy, moderate, and challenge days.
        </p>
        <div className="rounded-[var(--radius-md)] border border-border bg-bg px-3 py-3">
          <p className="text-xs text-text-muted">
            {isRestDay ? 'Today — rest day' : hasPlan ? "Today's target" : 'No plan yet'}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-text-primary">
            {isRestDay ? (
              'Recovery'
            ) : hasPlan && dailyTarget != null ? (
              <>
                {dailyTarget}
                <span className="ml-1.5 text-sm font-medium text-text-muted">push-ups</span>
              </>
            ) : (
              'Set up your plan'
            )}
          </p>
          {hasPlan && !isRestDay && todayPrescription && todayPrescription.sets > 0 ? (
            <p className="mt-1 text-xs text-text-muted">
              {formatDayTargetSetsDetail(todayPrescription)}
            </p>
          ) : null}
          {wizardCompleted && hasPlan ? (
            <p className="mt-2 text-xs text-text-muted">
              Max clean {plan?.max_clean_set} · Peak day this week: {peakDayTarget} · Week{' '}
              {todayPrescription?.mesocycleWeek ?? 1} of 4
            </p>
          ) : (
            <p className="mt-1 text-xs text-text-muted">
              Complete the wizard to set a personalised plan.
            </p>
          )}
        </div>
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

      <Card padding="md" className="space-y-4">
        <div>
          <p className="text-sm font-medium text-text-primary">Push reminders</p>
          <p className="mt-1 text-xs text-text-muted">
            Reminders when you are behind your daily goal during your chosen hours and frequency.
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
                    {getPwaInstallHintForPush(pushPlatform)}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">Reminders</p>
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
                      Status: {prefs?.push_enabled ? 'on' : 'off'}
                    </p>
                  </div>
                  <Button
                    variant={prefs?.push_enabled ? 'secondary' : 'primary'}
                    loading={registering || saving}
                    disabled={
                      pushPermission === 'denied' && !prefs?.push_enabled
                    }
                    onClick={() => void handleTogglePush()}
                  >
                    {pushButtonLabel()}
                  </Button>
                </div>

                {pushReady ? (
                  <p className={cn(noticeInlineClass('accent'), 'text-text-muted')}>
                    Reminders only work in the installed home-screen app. If you removed PushUS,
                    turn reminders off and on again after reinstalling.
                  </p>
                ) : null}

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

      <GroupAdminSettings />

      <Card padding="md" className="space-y-2">
        <SettingsLinkRow to="/about" title={`About ${appConfig.name}`} />
      </Card>

      <Button variant="danger" fullWidth onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  )
}
