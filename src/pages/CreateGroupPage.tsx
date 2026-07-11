import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button, ButtonRouterLink, Card, Skeleton, useToast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { detectTimezone, timezoneOptions } from '@/lib/timezones'
import { cn } from '@/lib/cn'
import { getPendingInviteCode } from '@/lib/storage'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useAuth } from '@/providers/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

function friendlyCreateGroupError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('duplicate') || lower.includes('already') || lower.includes('unique')) {
    return 'You already have a group with that name. Try a different one.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network hiccup — check your connection and try again.'
  }
  return "Couldn't create your group. Please try again."
}

export function CreateGroupPage() {
  useDocumentTitle('Create group')
  const navigate = useNavigate()
  const { toast } = useToast()
  const { appAccess } = useAuth()
  const { refreshGroup, setActiveGroupId, hasActiveGroup, loading: groupLoading } =
    useActiveGroup()

  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(detectTimezone)
  const [creating, setCreating] = useState(false)

  const pendingInvite = getPendingInviteCode()

  if (groupLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-sm flex-1 py-6 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-32 w-full rounded-[var(--radius-lg)]" />
        </div>
      </div>
    )
  }

  if (hasActiveGroup) {
    return <Navigate to="/today" replace />
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ message: 'Group name is required.', variant: 'danger' })
      return
    }

    setCreating(true)
    const { data: groupId, error } = await supabase.rpc('create_group', {
      p_name: trimmed,
      p_timezone: timezone,
    })
    setCreating(false)

    if (error) {
      console.error('create_group failed', error)
      toast({ message: friendlyCreateGroupError(error.message), variant: 'danger' })
      return
    }

    if (groupId) {
      setActiveGroupId(groupId as string)
    }

    await refreshGroup()
    toast({ message: 'Group created. Next: send this link to your mates.', variant: 'success' })
    navigate('/group', { replace: true })
  }

  if (!appAccess.can_create_group) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-sm flex-1 py-6">
          <Card padding="lg" className="space-y-4 text-center">
            <p className="text-4xl" aria-hidden="true">
              🔒
            </p>
            <h1 className="text-xl font-bold text-text-primary">Invite required</h1>
            <p className="text-sm text-text-muted">
              During private beta, new groups can only be created by approved organisers. Join an
              existing crew with your invite link instead.
            </p>
            <div className="flex flex-col gap-2">
              {pendingInvite ? (
                <ButtonRouterLink to={`/join/${pendingInvite}`} fullWidth>
                  Use saved invite code
                </ButtonRouterLink>
              ) : null}
              {/* Always give a way to enter a code by hand — this screen tells
                  them to join with an invite, so the action must be here. */}
              <ButtonRouterLink
                to="/join"
                variant={pendingInvite ? 'secondary' : undefined}
                fullWidth
              >
                Enter an invite code
              </ButtonRouterLink>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-sm flex-1 py-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-accent">Step 2 of 2</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Create your first group</h1>
          <p className="mt-2 text-sm text-text-muted">
            Start a private push-up group for your mates.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          <Card padding="lg" className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="groupName" className="text-sm font-medium text-text-primary">
                Group name
              </label>
              <input
                id="groupName"
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Morning Push Crew"
                className={cn(
                  'w-full rounded-[var(--radius-md)] border border-border bg-bg px-4 py-3',
                  'text-sm text-text-primary placeholder:text-text-muted',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="groupTimezone" className="text-sm font-medium text-text-primary">
                Group timezone
              </label>
              <select
                id="groupTimezone"
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
              <p className="text-xs text-text-muted">
                Daily totals reset at midnight in this timezone.
              </p>
            </div>
          </Card>

          <Button type="submit" fullWidth loading={creating} disabled={creating}>
            Create group
          </Button>
        </form>

        {/* Escape hatch: landing here doesn't mean you must create a group. */}
        <Link
          to="/join"
          className="mt-4 block text-center text-sm font-medium text-text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-[var(--radius-sm)]"
        >
          Got an invite code? Join a mate&apos;s group instead →
        </Link>
      </div>
    </div>
  )
}
