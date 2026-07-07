export type MateConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked'

export type MateUser = {
  id: string
  display_name: string
  name_initial: string | null
  avatar_emoji: string
}

export type MateListItem = {
  connection_id: string
  status: MateConnectionStatus
  direction: 'incoming' | 'outgoing'
  created_at: string
  user: MateUser
}

export type MateStats = {
  user_id: string
  today_total: number
  seven_day_total: number
  thirty_day_total: number
  best_day_30: number
}

export type MateLeaderboardRow = {
  user_id: string
  display_name: string
  name_initial: string | null
  avatar_emoji: string
  total: number
}

export type NudgeKind = 'push' | 'cheer' | 'stir'

export type MateChallengeStatus = 'pending' | 'active' | 'declined' | 'cancelled'

export type MateChallengeItem = {
  id: string
  status: MateChallengeStatus
  duration_days: number
  starts_at: string | null
  ends_at: string | null
  created_at: string
  is_challenger: boolean
  my_total: number
  their_total: number
  opponent: MateUser
}
