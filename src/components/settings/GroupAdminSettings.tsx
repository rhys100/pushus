import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AvatarChip,
  Button,
  Card,
  Skeleton,
  useToast,
} from '@/components/ui'
import { InviteShareCard } from '@/components/group/InviteShareCard'
import { EntryModerationSettings } from '@/components/settings/EntryModerationSettings'
import { SettingsLinkRow } from '@/components/settings/SettingsLinkRow'
import { supabase } from '@/lib/supabase'
import { billingConfig } from '@/lib/billing'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import type { JoinRequest } from '@/types/database'

async function fetchJoinRequests(groupId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase.rpc('list_pending_join_requests', {
    p_group_id: groupId,
  })

  if (error) throw error
  return (data ?? []) as JoinRequest[]
}

export function GroupAdminSettings() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { activeGroup, role } = useActiveGroup()
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)

  const isAdmin = role === 'owner' || role === 'admin'
  const isOwner = role === 'owner'
  const groupId = activeGroup?.id

  const requestsQuery = useQuery({
    queryKey: ['join-requests', groupId],
    queryFn: () => fetchJoinRequests(groupId!),
    enabled: Boolean(groupId && isAdmin),
    refetchInterval: 15_000,
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

  if (!activeGroup || !isAdmin) {
    return null
  }

  return (
    <Card padding="md" className="space-y-4">
      <div>
        <p className="text-sm font-medium text-text-primary">Group admin</p>
        <p className="mt-1 text-xs text-text-muted">
          Manage {activeGroup.name} — invites, join requests, and billing.
        </p>
      </div>

      {isAdmin && activeGroup.invite_code_enabled && activeGroup.invite_code ? (
        <InviteShareCard inviteCode={activeGroup.invite_code} />
      ) : null}

      {isOwner && billingConfig.enabled ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-3">
          <div>
            <p className="text-sm text-text-primary">Group billing</p>
            <p className="text-xs text-text-muted">Manage plan, trial, and invoices.</p>
          </div>
          <Link
            to="/group/billing"
            className="text-sm font-semibold text-accent hover:underline"
          >
            Open
          </Link>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Join requests
        </p>
        {requestsQuery.isLoading && !requestsQuery.data ? (
          <Card padding="md" className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <p className="text-xs text-text-muted">Checking join requests…</p>
          </Card>
        ) : requestsQuery.error ? (
          <p className="text-sm text-danger">Could not load join requests.</p>
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
          <p className="text-sm text-text-muted">No pending join requests.</p>
        )}
      </div>

      <EntryModerationSettings group={activeGroup} />

      <SettingsLinkRow
        to="/group"
        title="View group members"
        description="See who is in your group"
      />
    </Card>
  )
}
