import { useAppUpdateCheck } from '@/hooks/useAppUpdateCheck'

export function AppUpdateChecker() {
  useAppUpdateCheck()
  return null
}
