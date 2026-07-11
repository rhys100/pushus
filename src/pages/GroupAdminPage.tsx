import { Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { BackLink } from '@/components/ui/BackLink'
import { GroupAdminSettings } from '@/components/settings/GroupAdminSettings'
import { useActiveGroup } from '@/hooks/useActiveGroup'

/**
 * Group-admin management on its own page, split out from personal Settings so
 * it's obvious you're changing the group, not your own preferences. Reached via
 * the admin-only "Group admin" link on Settings; non-admins get bounced back.
 */
export function GroupAdminPage() {
  const { activeGroup, role, loading } = useActiveGroup()
  const isAdmin = role === 'owner' || role === 'admin'

  if (!loading && (!activeGroup || !isAdmin)) {
    return <Navigate to="/settings" replace />
  }

  return (
    <AppLayout
      title="Group admin"
      subtitle={activeGroup ? `Manage ${activeGroup.name}` : 'Group settings'}
      showNav={false}
      headerLeading={<BackLink to="/settings" label="Settings" />}
    >
      <div className="space-y-4 pb-8">
        <GroupAdminSettings />
      </div>
    </AppLayout>
  )
}
