import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card, Skeleton } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { useActiveGroup } from '@/hooks/useActiveGroup'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

async function fetchPendingGroupName(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_pending_group_name', {
    p_group_id: groupId,
  })

  if (error) throw error
  return data as string
}

export function PendingPage() {
  useDocumentTitle('Pending approval')
  const { signOut } = useAuth()
  const { pendingGroupId, refreshGroup } = useActiveGroup()
  const [isChecking, setIsChecking] = useState(false)

  const groupNameQuery = useQuery({
    queryKey: ['pending-group-name', pendingGroupId],
    queryFn: () => fetchPendingGroupName(pendingGroupId!),
    enabled: Boolean(pendingGroupId),
    refetchInterval: 15_000,
  })

  // Poll the membership too — once the admin approves, the route guard whisks
  // the member in without them having to tap "Check again".
  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshGroup()
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [refreshGroup])

  async function handleRefresh() {
    setIsChecking(true)
    try {
      await refreshGroup()
      await groupNameQuery.refetch()
    } finally {
      setIsChecking(false)
    }
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
            An admin needs to approve your request before you can start logging push-ups.
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

          <div className="space-y-2.5">
            <p
              className="flex items-center justify-center gap-2 text-xs text-text-muted"
              aria-live="polite"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              Checking automatically — you&apos;ll go straight in once approved.
            </p>
            <Button
              variant="secondary"
              fullWidth
              loading={isChecking}
              disabled={isChecking}
              onClick={handleRefresh}
            >
              Check now
            </Button>
          </div>
        </Card>

        <Button variant="ghost" fullWidth className="mt-4" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
