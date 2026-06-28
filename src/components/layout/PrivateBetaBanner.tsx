import { appConfig } from '@/lib/config'
import { useAuth } from '@/providers/AuthProvider'

export function PrivateBetaBanner() {
  const { appAccess } = useAuth()

  if (!appAccess.private_beta_enabled) return null

  return (
    <div className="border-b border-border/60 bg-surface/90 px-4 py-1 text-center">
      <span className="inline-flex max-w-fit items-center rounded-full border border-border/70 bg-bg/60 px-3 py-0.5 text-[0.6875rem] text-text-muted">
        <span className="font-medium text-text-primary">Private beta</span>
        {' · '}
        {appConfig.deploymentName}
      </span>
    </div>
  )
}
