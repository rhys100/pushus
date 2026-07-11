import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AvatarChip,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/ui'
import { BillingBanner } from '@/components/billing/BillingBanner'
import { InviteShareCard } from '@/components/group/InviteShareCard'
import { MemberAliasSheet } from '@/components/group/MemberAliasSheet'
import { useTabPageMeta } from '@/components/layout/TabPageMeta'
import { billingConfig } from '@/lib/billing'
import { tapHaptic } from '@/lib/haptics'
import { formatMemberListName } from '@/lib/memberDisplayName'
import { getErrorMessage } from '@/lib/errors'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useGroupMembers } from '@/hooks/useGroupMembers'
import { useGroupAvailability } from '@/hooks/useAvailability'
import { useGroupBillingStatus, useGroupSubscription } from '@/hooks/useBilling'
import { useMemberAlias } from '@/hooks/useMemberAlias'
import { useAuth } from '@/providers/AuthProvider'
import type { GroupMemberWithProfile } from '@/types/database'

function roleLabel(role: string): string {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  return 'Member'
}

export function GroupPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { activeGroup, role } = useActiveGroup()
  const groupId = activeGroup?.id
  const isOwner = role === 'owner'
  const billingStatusQuery = useGroupBillingStatus(groupId)
  const subscriptionQuery = useGroupSubscription(groupId)
  const aliasMutation = useMemberAlias(groupId)
  const [aliasTarget, setAliasTarget] = useState<GroupMemberWithProfile | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  const membersQuery = useGroupMembers(groupId)

  const members = membersQuery.data ?? []
  const { data: availability } = useGroupAvailability(groupId)

  const memberCount = useMemo(() => {
    if (membersQuery.isLoading && !membersQuery.data) return null
    return members.length
  }, [membersQuery.isLoading, membersQuery.data, members.length])

  const memberSubtitle =
    memberCount === null ? 'Loading members…' : `${memberCount} member${memberCount === 1 ? '' : 's'}`

  useTabPageMeta({
    title: activeGroup?.name,
    subtitle: memberSubtitle,
  })

  async function handleSaveAlias(alias: string) {
    if (!aliasTarget) return

    try {
      await aliasMutation.mutateAsync({
        memberUserId: aliasTarget.user_id,
        alias,
      })
      toast({ message: 'Mate label saved.', variant: 'success' })
      setAliasTarget(null)
    } catch (error) {
      toast({
        message: getErrorMessage(error, 'Could not save label.'),
        variant: 'danger',
      })
    }
  }

  async function handleClearAlias() {
    if (!aliasTarget) return

    try {
      await aliasMutation.mutateAsync({
        memberUserId: aliasTarget.user_id,
        alias: null,
      })
      toast({ message: 'Mate label cleared.', variant: 'success' })
      setAliasTarget(null)
    } catch (error) {
      toast({
        message: getErrorMessage(error, 'Could not clear label.'),
        variant: 'danger',
      })
    }
  }

  if (!activeGroup) {
    return (
      <EmptyState
        title="No group yet"
        description="Create a group or join one with an invite code."
        actionLabel="Create group"
        onAction={() => navigate('/group/create')}
      />
    )
  }

  const showMembersSkeleton = membersQuery.isLoading && members.length === 0
  const aliasProfile = aliasTarget?.profiles
  const isAdmin = role === 'owner' || role === 'admin'
  const canInvite =
    isAdmin && activeGroup.invite_code_enabled && Boolean(activeGroup.invite_code)
  const isSoloOwner = canInvite && memberCount === 1

  return (
    <div className="space-y-4 pb-4">
      {membersQuery.isFetching && members.length > 0 ? (
        <p className="text-xs text-text-muted" aria-live="polite">
          Refreshing members…
        </p>
      ) : null}

      {billingConfig.enabled ? (
        <BillingBanner
          billingStatus={billingStatusQuery.data ?? activeGroup.billing_status}
          subscription={subscriptionQuery.data}
          isOwner={isOwner}
        />
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <Card
          padding="sm"
          role="button"
          tabIndex={0}
          className="cursor-pointer transition-[border-color,transform] duration-[var(--duration-fast)] hover:border-accent/30 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          onClick={() => {
            tapHaptic()
            navigate('/mates')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              navigate('/mates')
            }
          }}
        >
          <p className="text-lg">🤝</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">Mates</p>
          <p className="text-xs text-text-muted">Nudges and 1v1s</p>
        </Card>
        <Card
          padding="sm"
          role="button"
          tabIndex={0}
          className="cursor-pointer transition-[border-color,transform] duration-[var(--duration-fast)] hover:border-accent/30 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          onClick={() => {
            tapHaptic()
            navigate('/challenges')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              navigate('/challenges')
            }
          }}
        >
          <p className="text-lg">🏆</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">Challenges</p>
          <p className="text-xs text-text-muted">Group comps</p>
        </Card>
        <Card
          padding="sm"
          role="button"
          tabIndex={0}
          className="cursor-pointer transition-[border-color,transform] duration-[var(--duration-fast)] hover:border-accent/30 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          onClick={() => {
            tapHaptic()
            navigate('/achievements')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              navigate('/achievements')
            }
          }}
        >
          <p className="text-lg">🏅</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">Badges</p>
          <p className="text-xs text-text-muted">XP and streaks</p>
        </Card>
      </div>

      {canInvite ? (
        <section className="space-y-2">
          {isSoloOwner ? (
            <>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Invite your first mate</h2>
                <p className="text-xs text-text-muted">
                  You&apos;re the only one here — share your group link to get the crew going.
                </p>
              </div>
              <InviteShareCard inviteCode={activeGroup.invite_code} />
            </>
          ) : showInvite ? (
            <InviteShareCard inviteCode={activeGroup.invite_code} />
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setShowInvite(true)}>
              Invite mates
            </Button>
          )}
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">Members</h2>
          <p className="text-xs text-text-muted">Tap a mate to rename for yourself</p>
        </div>
        {showMembersSkeleton ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-[var(--radius-lg)]" />
          </div>
        ) : membersQuery.error ? (
          <div className="flex flex-col items-start gap-2 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3">
            <p className="text-sm text-danger">Could not load members.</p>
            <Button
              variant="secondary"
              className="min-h-9 px-4 text-sm"
              loading={membersQuery.isFetching}
              onClick={() => void membersQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : members.length > 0 ? (
          <div className="space-y-2">
            {members.map((member) => {
              const profile = member.profiles
              const displayName = profile
                ? formatMemberListName(profile, member.viewer_alias)
                : 'Member'
              const isSelf = member.user_id === user?.id
              const canRename = !isSelf && Boolean(profile)

              return (
                <Card
                  key={member.id}
                  padding="sm"
                  className={
                    canRename
                      ? 'cursor-pointer transition-colors hover:border-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
                      : undefined
                  }
                  onClick={canRename ? () => setAliasTarget(member) : undefined}
                  onKeyDown={
                    canRename
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setAliasTarget(member)
                          }
                        }
                      : undefined
                  }
                  role={canRename ? 'button' : undefined}
                  tabIndex={canRename ? 0 : undefined}
                  aria-label={canRename ? `Rename ${displayName}` : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <AvatarChip
                      emoji={profile?.avatar_emoji ?? '💪'}
                      name={displayName}
                      className="flex-1 border-0 bg-transparent p-0"
                    />
                    {availability?.get(member.user_id) ? (
                      <Badge variant="warning">
                        {availability.get(member.user_id)!.status === 'injured'
                          ? '🤕 Injured'
                          : '⏸️ Out'}
                      </Badge>
                    ) : null}
                    <Badge
                      variant={
                        member.role === 'owner'
                          ? 'accent'
                          : member.role === 'admin'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {roleLabel(member.role)}
                    </Badge>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <EmptyState title="No members yet" description="Invite someone to get started." />
        )}
      </section>

      {aliasProfile ? (
        <MemberAliasSheet
          open={Boolean(aliasTarget)}
          saving={aliasMutation.isPending}
          profile={aliasProfile}
          currentAlias={aliasTarget?.viewer_alias}
          onSave={(alias) => void handleSaveAlias(alias)}
          onClear={() => void handleClearAlias()}
          onClose={() => setAliasTarget(null)}
        />
      ) : null}
    </div>
  )
}
