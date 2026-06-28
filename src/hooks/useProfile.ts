import { useAuth } from '@/providers/AuthProvider'

export function useProfile() {
  const {
    profile,
    loading,
    refreshProfile,
    profileOnboarded,
    appAccess,
    refreshAppAccess,
  } = useAuth()

  return {
    profile,
    loading,
    refreshProfile,
    profileOnboarded,
    appAccess,
    refreshAppAccess,
  }
}
