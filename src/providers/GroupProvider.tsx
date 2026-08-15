import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  clearStoredActiveGroupId,
  getStoredActiveGroupId,
  setStoredActiveGroupId,
} from '@/lib/storage'
import { withTimeout } from '@/lib/withTimeout'
import { useAuth } from '@/providers/AuthProvider'
import type { Group, GroupMember, MemberRole, MemberStatus } from '@/types/database'

const GROUP_FETCH_TIMEOUT_MS = 5_000

type GroupContextValue = {
  activeGroup: Group | null
  membership: GroupMember | null
  membershipStatus: MemberStatus | null
  role: MemberRole | null
  pendingGroupId: string | null
  hasActiveGroup: boolean
  loading: boolean
  setActiveGroupId: (groupId: string) => void
  refreshGroup: () => Promise<void>
}

const GroupContext = createContext<GroupContextValue | null>(null)

type MembershipsResult = {
  memberships: GroupMember[]
  /** Groups that came back embedded, used to seed the group query cache. */
  groups: Group[]
}

/**
 * Memberships and the active group used to be two serial round trips on every
 * cold start — the group query could not even begin until memberships resolved
 * and named an active group. Embedding `groups(*)` over the existing foreign key
 * collapses that into one request, and the embedded row seeds the ['group', id]
 * cache so `groupQuery` resolves without touching the network.
 *
 * The embed is an optimisation, not a contract: if RLS declines to expose the
 * group here it simply arrives null and the standalone fetchGroup still runs.
 */
async function fetchMemberships(userId: string): Promise<MembershipsResult> {
  const { data, error } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, status, created_at, groups(*)')
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load memberships', error)
    return { memberships: [], groups: [] }
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const memberships: GroupMember[] = []
  const groups: Group[] = []

  for (const row of rows) {
    const { groups: embedded, ...membership } = row
    memberships.push(membership as unknown as GroupMember)

    // PostgREST returns a to-one embed as an object, but tolerate an array.
    const group = Array.isArray(embedded) ? embedded[0] : embedded
    if (group) {
      groups.push(group as Group)
    }
  }

  return { memberships, groups }
}

async function fetchGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load group', error)
    return null
  }

  return data as Group | null
}

function pickActiveMembership(memberships: GroupMember[]): {
  active: GroupMember | null
  pending: GroupMember | null
} {
  const active = memberships.find((m) => m.status === 'active') ?? null
  const pending = memberships.find((m) => m.status === 'pending') ?? null
  return { active, pending }
}

export function GroupProvider({ children }: { children: ReactNode }) {
  const { user, profileOnboarded } = useAuth()
  const queryClient = useQueryClient()
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(null)

  const membershipsQuery = useQuery({
    queryKey: ['memberships', user?.id],
    queryFn: async () => {
      const result = await withTimeout(fetchMemberships(user!.id), GROUP_FETCH_TIMEOUT_MS, {
        memberships: [],
        groups: [],
      } satisfies MembershipsResult)

      // Seed before returning so the group query below is already warm on the
      // render that first learns which group is active.
      for (const group of result.groups) {
        queryClient.setQueryData(['group', group.id], group)
      }

      return result
    },
    enabled: Boolean(user && profileOnboarded),
  })

  // Stable identity: this feeds an effect that reads localStorage, and a fresh
  // [] on every render would re-run it on every render of the whole app.
  const memberships = useMemo(
    () => membershipsQuery.data?.memberships ?? [],
    [membershipsQuery.data],
  )
  const { active: activeMembership, pending: pendingMembership } =
    pickActiveMembership(memberships)

  useEffect(() => {
    if (!user || !profileOnboarded) {
      setActiveGroupIdState(null)
      return
    }

    if (activeMembership) {
      const stored = getStoredActiveGroupId()
      const validStored =
        stored && memberships.some((m) => m.group_id === stored && m.status === 'active')
      const nextId = validStored ? stored : activeMembership.group_id
      setActiveGroupIdState(nextId)
      if (nextId) setStoredActiveGroupId(nextId)
      return
    }

    setActiveGroupIdState(null)
    clearStoredActiveGroupId()
  }, [user, profileOnboarded, activeMembership, memberships])

  const groupQuery = useQuery({
    queryKey: ['group', activeGroupId],
    queryFn: () => withTimeout(fetchGroup(activeGroupId!), GROUP_FETCH_TIMEOUT_MS, null),
    enabled: Boolean(activeGroupId && activeMembership),
  })

  const setActiveGroupId = useCallback((groupId: string) => {
    setStoredActiveGroupId(groupId)
    setActiveGroupIdState(groupId)
  }, [])

  const refreshGroup = useCallback(async () => {
    if (user?.id) {
      await queryClient.invalidateQueries({ queryKey: ['memberships', user.id] })
    }

    if (activeGroupId) {
      await queryClient.invalidateQueries({ queryKey: ['group', activeGroupId] })
    }
  }, [queryClient, user?.id, activeGroupId])

  const currentMembership =
    memberships.find((m) => m.group_id === activeGroupId && m.status === 'active') ??
    activeMembership

  const value = useMemo<GroupContextValue>(
    () => ({
      activeGroup: groupQuery.data ?? null,
      membership: currentMembership,
      membershipStatus: currentMembership?.status ?? pendingMembership?.status ?? null,
      role: currentMembership?.role ?? null,
      pendingGroupId: pendingMembership?.group_id ?? null,
      hasActiveGroup: Boolean(activeMembership),
      loading: membershipsQuery.isLoading || groupQuery.isLoading,
      setActiveGroupId,
      refreshGroup,
    }),
    [
      groupQuery.data,
      groupQuery.isLoading,
      activeMembership,
      currentMembership,
      pendingMembership,
      membershipsQuery.isLoading,
      setActiveGroupId,
      refreshGroup,
    ],
  )

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

export function useGroup(): GroupContextValue {
  const context = useContext(GroupContext)
  if (!context) {
    throw new Error('useGroup must be used within a GroupProvider')
  }
  return context
}
