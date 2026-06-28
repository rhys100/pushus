import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AvatarChip,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/ui'
import { InviteShareCard } from '@/components/group/InviteShareCard'
import { BillingBanner } from '@/components/billing/BillingBanner'
import { useTabPageMeta } from '@/components/layout/TabPageMeta'
import { supabase } from '@/lib/supabase'
import { billingConfig } from '@/lib/billing'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useGroupBillingStatus, useGroupSubscription } from '@/hooks/useBilling'
import type { GroupMemberWithProfile, JoinRequest } from '@/types/database'

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

async function fetchJoinRequests(groupId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase.rpc('list_pending_join_requests', {
    p_group_id: groupId,
  })

  if (error) throw error
  return (data ?? []) as JoinRequest[]
}

function roleLabel(role: string): string {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  return 'Member'
}

function GroupSettingsLink() {
  return (
    <Link
      to="/settings"
      className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] text-text-muted hover:text-text-primary"
      aria-label="Settings"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        />
      </svg>
    </Link>
  )
}

export function GroupPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { activeGroup, role } = useActiveGroup()
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)

  const isAdmin = role === 'owner' || role === 'admin'
  const isOwner = role === 'owner'
  const groupId = activeGroup?.id
  const billingStatusQuery = useGroupBillingStatus(groupId)
  const subscriptionQuery = useGroupSubscription(groupId)

  const membersQuery = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => fetchMembers(groupId!),
    enabled: Boolean(groupId),
    staleTime: 30_000,
  })

  const requestsQuery = useQuery({
    queryKey: ['join-requests', groupId],
    queryFn: () => fetchJoinRequests(groupId!),
    enabled: Boolean(groupId && isAdmin),
    refetchInterval: 15_000,
  })

  const members = membersQuery.data ?? []

  const memberCount = useMemo(() => {
    if (membersQuery.isLoading && !membersQuery.data) return null
    return members.length
  }, [membersQuery.isLoading, membersQuery.data, members.length])

  const memberSubtitle =
    memberCount === null ? 'Loading members…' : `${memberCount} member${memberCount === 1 ? '' : 's'}`

  const headerTrailing = useMemo(() => <GroupSettingsLink />, [])

  useTabPageMeta({
    title: activeGroup?.name,
    subtitle: memberSubtitle,
    headerTrailing,
  })

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      setProcessingRequestId(requestId)
      const { error } = await supabase.rpc('approve_join_request', {
        p_request_id: requestId,
      })
      if (error) throw error
    },
    onSettled: () => {
      setProcessingRequestId(null)
    },
    onSuccess: async () => {
      toast({ message: 'Member approved.', variant: 'success' })
      if (groupId) {
        await queryClient.invalidateQueries({ queryKey: ['group-members', groupId] })
        await queryClient.invalidateQueries({ queryKey: ['join-requests', groupId] })
      }
    },
    onError: (error: Error) => {
      toast({ message: error.message, variant: 'danger' })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      setProcessingRequestId(requestId)
      const { error } = await supabase.rpc('reject_join_request', {
        p_request_id: requestId,
      })
      if (error) throw error
    },
    onSettled: () => {
      setProcessingRequestId(null)
    },
    onSuccess: async () => {
      toast({ message: 'Request declined.', variant: 'default' })
      if (groupId) {
        await queryClient.invalidateQueries({ queryKey: ['join-requests', groupId] })
      }
    },
    onError: (error: Error) => {
      toast({ message: error.message, variant: 'danger' })
    },
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

      {isOwner && billingConfig.enabled ? (
        <Card padding="md" className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Group billing</p>
            <p className="text-xs text-text-muted">Manage plan, trial, and invoices.</p>
          </div>
          <Link
            to="/group/billing"
            className="text-sm font-semibold text-accent hover:underline"
          >
            Open
          </Link>
        </Card>
      ) : null}

      {isAdmin && activeGroup.invite_code_enabled && activeGroup.invite_code ? (
        <InviteShareCard inviteCode={activeGroup.invite_code} groupName={activeGroup.name} />
      ) : null}

      {isAdmin ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">Join requests</h2>
          {requestsQuery.isLoading && !requestsQuery.data ? (
            <Card padding="md" className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <p className="text-xs text-text-muted">Checking join requests…</p>
            </Card>
          ) : requestsQuery.error ? (
            <p className="text-sm text-danger">
              Could not load join requests. Pull to refresh or reopen this page.
            </p>
          ) : requestsQuery.data && requestsQuery.data.length > 0 ? (
            <div className="space-y-2">
              {requestsQuery.data.map((request) => (
                <Card key={request.id} padding="md" className="flex items-center gap-3">
                  <AvatarChip
                    emoji={request.profiles?.avatar_emoji ?? '💪'}
                    name={request.profiles?.display_name ?? 'New member'}
                    subtitle="Wants to join"
                    className="flex-1 border-0 bg-transparent p-0"
                  />
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="primary"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      loading={processingRequestId === request.id && approveMutation.isPending}
                      disabled={processingRequestId !== null}
                      onClick={() => approveMutation.mutate(request.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      loading={processingRequestId === request.id && rejectMutation.isPending}
                      disabled={processingRequestId !== null}
                      onClick={() => rejectMutation.mutate(request.id)}
                    >
                      Decline
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              No pending requests yet. Share your invite link to bring mates in.
            </p>
          )}
        </section>
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
