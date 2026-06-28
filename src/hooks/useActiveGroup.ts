import { useGroup } from '@/providers/GroupProvider'

export function useActiveGroup() {
  const {
    activeGroup,
    membership,
    membershipStatus,
    role,
    pendingGroupId,
    hasActiveGroup,
    loading,
    setActiveGroupId,
    refreshGroup,
  } = useGroup()

  return {
    activeGroup,
    membership,
    membershipStatus,
    role,
    pendingGroupId,
    hasActiveGroup,
    loading,
    setActiveGroupId,
    refreshGroup,
  }
}
