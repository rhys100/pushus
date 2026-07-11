import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Card, useToast } from '@/components/ui'
import { AVATAR_EMOJIS } from '@/lib/emojis'
import {
  fetchPostAuthSnapshot,
  navigateAfterAuth,
} from '@/lib/postAuthNavigation'
import { supabase } from '@/lib/supabase'
import { detectTimezone, timezoneOptions } from '@/lib/timezones'
import { tapHaptic } from '@/lib/haptics'
import { formatProfileName } from '@/lib/memberDisplayName'
import { cn } from '@/lib/cn'
import { getPendingInviteCode, markProfileCompleted } from '@/lib/storage'
import { useAuth } from '@/providers/AuthProvider'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

function friendlyOnboardingError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('duplicate') || lower.includes('already') || lower.includes('unique')) {
    return 'That name is already taken here. Try a different one.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network hiccup — check your connection and try again.'
  }
  return "Couldn't save your profile. Please try again."
}

export function OnboardingProfilePage() {
  useDocumentTitle('Set up profile')
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { user, profile, loading, refreshProfile, profileOnboarded } = useAuth()
  const { refreshGroup } = useActiveGroup()

  const [displayName, setDisplayName] = useState('')
  const [nameInitial, setNameInitial] = useState('')
  const [emoji, setEmoji] = useState<string>(AVATAR_EMOJIS[0])
  const [timezone, setTimezone] = useState(detectTimezone)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Selection pop only rewards a tap, not the default choice on mount.
  const [emojiInteracted, setEmojiInteracted] = useState(false)

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name)
    setNameInitial(profile.name_initial ?? '')
    setEmoji(profile.avatar_emoji)
    setTimezone(profile.timezone || detectTimezone())
  }, [profile])

  useEffect(() => {
    if (loading || !user || !profileOnboarded) return

    const returnTo = (location.state as { from?: string } | null)?.from

    void fetchPostAuthSnapshot(user.id).then((snapshot) => {
      navigateAfterAuth(navigate, snapshot, { replace: true, returnTo })
    })
  }, [loading, user, profileOnboarded, navigate, location.state])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return

    const trimmed = displayName.trim()
    if (!trimmed) {
      toast({ message: 'Display name is required.', variant: 'danger' })
      return
    }

    setSaving(true)
    setSubmitError(null)
    const inviteCode = getPendingInviteCode()
    const { error } = await supabase.rpc('complete_onboarding_profile', {
      p_display_name: trimmed,
      p_avatar_emoji: emoji,
      p_timezone: timezone,
      p_invite_code: inviteCode,
      p_name_initial: nameInitial.trim() || null,
    })

    if (error) {
      setSaving(false)
      console.error('complete_onboarding_profile failed', error)
      setSubmitError(friendlyOnboardingError(error.message))
      return
    }

    markProfileCompleted(user.id)

    await refreshProfile()
    await refreshGroup()
    const snapshot = await fetchPostAuthSnapshot(user.id)
    setSaving(false)
    navigateAfterAuth(navigate, snapshot, {
      replace: true,
      assumeProfileOnboarded: true,
    })
  }

  if (loading && !profile) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg">
        <p className="text-sm text-text-muted">Loading profile…</p>
      </div>
    )
  }

  if (profileOnboarded) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg">
        <p className="text-sm text-text-muted">Redirecting…</p>
      </div>
    )
  }

  const inviteCode = getPendingInviteCode()

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="motion-stagger mx-auto w-full max-w-sm flex-1 py-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-accent">Step 1 of 2</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Set up your profile</h1>
          <p className="mt-2 text-sm text-text-muted">
            How your mates will see you on the leaderboard.
          </p>
          {inviteCode ? (
            <p className="mt-2 text-xs text-text-muted">
              Invite code saved:{' '}
              <span className="font-mono text-text-primary">{inviteCode}</span>
            </p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Card padding="lg" className="space-y-5">
            {/* Live preview so the emoji + initial choices feel concrete. */}
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-2xl">
                {emoji}
              </span>
              <div className="min-w-0">
                <p className="text-[0.65rem] font-medium uppercase tracking-wide text-text-muted">
                  On the leaderboard
                </p>
                <p className="truncate font-semibold text-text-primary">
                  {displayName.trim()
                    ? formatProfileName({
                        display_name: displayName.trim(),
                        name_initial: nameInitial.trim() || null,
                      })
                    : 'Your name'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="displayName" className="text-sm font-medium text-text-primary">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                required
                maxLength={40}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Rhys"
                aria-invalid={submitError ? true : undefined}
                aria-describedby={submitError ? 'onboarding-name-error' : undefined}
                className={cn(
                  'w-full rounded-[var(--radius-md)] border border-border bg-bg px-4 py-3',
                  'text-sm text-text-primary placeholder:text-text-muted',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="nameInitial" className="text-sm font-medium text-text-primary">
                Initial <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <input
                id="nameInitial"
                type="text"
                maxLength={1}
                inputMode="text"
                autoComplete="off"
                value={nameInitial}
                onChange={(e) => setNameInitial(e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1))}
                placeholder="E"
                className={cn(
                  'w-20 rounded-[var(--radius-md)] border border-border bg-bg px-4 py-3',
                  'text-sm text-text-primary placeholder:text-text-muted',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                )}
              />
              <p className="text-xs text-text-muted">
                Add a letter so mates can tell you apart — e.g. Sam T.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-text-primary">Avatar emoji</span>
              <div className="grid grid-cols-8 gap-2">
                {AVATAR_EMOJIS.map((option, index) => (
                  // Entrance cascade lives on the wrapper so it can't clash
                  // with the button's own selection-pop animation.
                  <span
                    key={option}
                    className="cal-pop"
                    style={{ animationDelay: `${index * 12}ms` }}
                  >
                    <button
                      type="button"
                      aria-label={`Select ${option}`}
                      aria-pressed={emoji === option}
                      onClick={() => {
                        if (emoji !== option) {
                          tapHaptic()
                          setEmojiInteracted(true)
                        }
                        setEmoji(option)
                      }}
                      className={cn(
                        'flex h-10 w-full items-center justify-center rounded-[var(--radius-md)] text-xl',
                        'border transition-[border-color,background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)]',
                        'active:scale-90',
                        emoji === option
                          ? cn('border-accent bg-accent-muted', emojiInteracted && 'motion-pop')
                          : 'border-border bg-bg hover:border-accent/30',
                      )}
                    >
                      {option}
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="timezone" className="text-sm font-medium text-text-primary">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={cn(
                  'w-full rounded-[var(--radius-md)] border border-border bg-bg px-4 py-3',
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
          </Card>

          <Button type="submit" fullWidth loading={saving} disabled={saving || !user}>
            Continue
          </Button>
          {submitError ? (
            <p
              id="onboarding-name-error"
              role="alert"
              className="text-center text-sm text-danger"
            >
              {submitError}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}
