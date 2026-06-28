import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AvatarChip,
  Badge,
  Card,
  EmptyState,
  Skeleton,
} from '@/components/ui'
import { BillingBanner } from '@/components/billing/BillingBanner'
import { useTabPageMeta } from '@/components/layout/TabPageMeta'
import { supabase } from '@/lib/supabase'
import { billingConfig } from '@/lib/billing'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useGroupBillingStatus, useGroupSubscription } from '@/hooks/useBilling'
import type { GroupMemberWithProfile } from '@/types/database'

async function fetchMembers(groupId: string): Promise<GroupMemberWithProfile[]> {
  const { data, error } = await supabase.rpc('list_group_members', {
    p_group_id: groupId,
  })

  if (error) throw error

  const parsed =
    typeof data === 'string'
      ? (JSON.parse(data) as GroupMemberWithProfile[])
      : ((data ?? []) as GroupMemberWithProfile[])

  return Array.isArray(parsed) ? parsed : []
}

function roleLabel(role: string): string {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  return 'Member'
}

export function GroupPage() {
  const navigate = useNavigate()
  const { activeGroup, role } = useActiveGroup()
  const groupId = activeGroup?.id
  const isOwner = role === 'owner'
  const billingStatusQuery = useGroupBillingStatus(groupId)
  const subscriptionQuery = useGroupSubscription(groupId)

  const membersQuery = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => fetchMembers(groupId!),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  })

  const members = membersQuery.data ?? []

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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text-primary">Members</h2>
        {showMembersSkeleton ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-[var(--radius-lg)]" />
          </div>
        ) : membersQuery.error ? (
          <p className="text-sm text-danger">
            Could not load members. Pull to refresh or reopen this page.
          </p>
        ) : members.length > 0 ? (
          <div className="space-y-2">
            {members.map((member) => (
              <Card key={member.id} padding="sm">
                <div className="flex items-center justify-between gap-3">
                  <AvatarChip
                    emoji={member.profiles?.avatar_emoji ?? '💪'}
                    name={member.profiles?.display_name ?? 'Member'}
                    className="flex-1 border-0 bg-transparent p-0"
                  />
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
            ))}
          </div>
        ) : (
          <EmptyState title="No members yet" description="Invite someone to get started." />
        )}
      </section>
    </div>
  )
}
