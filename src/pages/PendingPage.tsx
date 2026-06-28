import { useQuery } from '@tanstack/react-query'
import { Button, Card, Skeleton } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { useActiveGroup } from '@/hooks/useActiveGroup'

async function fetchPendingGroupName(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_pending_group_name', {
    p_group_id: groupId,
  })

  if (error) throw error
  return data as string
}

export function PendingPage() {
  const { signOut } = useAuth()
  const { pendingGroupId, refreshGroup } = useActiveGroup()

  const groupNameQuery = useQuery({
    queryKey: ['pending-group-name', pendingGroupId],
    queryFn: () => fetchPendingGroupName(pendingGroupId!),
    enabled: Boolean(pendingGroupId),
    refetchInterval: 15_000,
  })

  async function handleRefresh() {
    await refreshGroup()
    await groupNameQuery.refetch()
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-8 text-center">
          <p className="text-5xl" aria-hidden="true">
            ⏳
          </p>
          <h1 className="mt-4 text-2xl font-bold text-text-primary">Awaiting approval</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Waiting for the group admin to approve you.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">
            An admin needs to approve your request before you can log push-ups.
          </p>
        </div>

        <Card padding="lg" className="space-y-4 text-center">
          {groupNameQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="mx-auto h-6 w-40" />
              <Skeleton className="mx-auto h-4 w-56" />
            </div>
          ) : groupNameQuery.error ? (
            <p className="text-sm text-danger">
              Could not load group details. Try refreshing.
            </p>
          ) : (
            <>
              <p className="text-sm text-text-muted">You requested to join</p>
              <p className="text-xl font-semibold text-text-primary">
                {groupNameQuery.data ?? 'your group'}
              </p>
            </>
          )}

          <Button variant="secondary" fullWidth onClick={handleRefresh}>
            Check again
          </Button>
        </Card>

        <Button variant="ghost" fullWidth className="mt-4" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
