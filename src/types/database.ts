export type MemberRole = 'owner' | 'admin' | 'member'
export type MemberStatus = 'pending' | 'active' | 'removed' | 'left'
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected'

export type Profile = {
  id: string
  display_name: string
  name_initial: string | null
  avatar_emoji: string
  avatar_color: string
  timezone: string
  show_rep_totals: boolean
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

export type Group = {
  id: string
  name: string
  timezone: string
  owner_id: string
  max_members: number
  default_invite_limit: number
  max_single_entry: number
  invite_code: string
  invite_code_enabled: boolean
  billing_status: string
  created_at: string
  updated_at: string
}

export type GroupMember = {
  id: string
  group_id: string
  user_id: string
  role: MemberRole
  status: MemberStatus
  joined_at: string | null
  created_at: string
  updated_at: string
}

export type GroupMemberWithProfile = GroupMember & {
  viewer_alias?: string | null
  profiles: Pick<Profile, 'display_name' | 'name_initial' | 'avatar_emoji' | 'avatar_color'>
}

export type JoinRequest = {
  id: string
  group_id: string
  user_id: string
  status: JoinRequestStatus
  created_at: string
  profiles: Pick<Profile, 'display_name' | 'avatar_emoji' | 'avatar_color'> | null
}

export type NotificationEventType =
  | 'reminder_sent'
  | 'reminder_failed'
  | 'subscription_disabled'

export type NotificationPreferences = {
  user_id: string
  push_enabled: boolean
  active_hours_start: number
  active_hours_end: number
  reminder_interval_hours: 1 | 2 | 24
  daily_target: number
  injury_paused: boolean
  injury_paused_until: string | null
  last_reminder_sent_at: string | null
  created_at: string
  updated_at: string
}

export type PushSubscription = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

export type NotificationEvent = {
  id: string
  user_id: string
  subscription_id: string | null
  event_type: NotificationEventType
  payload: Record<string, unknown>
  http_status: number | null
  created_at: string
}
