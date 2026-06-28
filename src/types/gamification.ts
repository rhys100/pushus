export type CompetitionKind = 'weekly' | 'monthly' | 'custom'
export type ChallengeType =
  | 'total_target'
  | 'team_total'
  | 'leaderboard'
  | 'streak'
  | 'improvement'
export type CompetitionIntensity = 'fun' | 'moderate' | 'hard' | 'stupid'

export type Competition = {
  id: string
  group_id: string
  name: string
  competition_kind: CompetitionKind
  challenge_type: ChallengeType
  intensity: CompetitionIntensity
  starts_at: string
  ends_at: string
  replaces_daily_plan: boolean
  target_total: number | null
  settings: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export type Achievement = {
  id: string
  slug: string
  name: string
  description: string
  icon_emoji: string
  criteria: Record<string, unknown>
  sort_order: number
  created_at: string
}

export type UserAchievement = {
  id: string
  user_id: string
  group_id: string
  achievement_id: string
  unlocked_at: string
  achievements?: Achievement
}

export type UserXpTotal = {
  user_id: string
  group_id: string
  total_xp: number
  updated_at: string
}

export type TrainingPlanRow = {
  id: string
  user_id: string
  group_id: string
  wizard_completed: boolean
  max_clean_set: number
  training_level: string
  challenge_intensity: string
  preferred_training_days: number[]
  rest_days: number[]
  easy_days: number[]
  recommended_set_size: number
  overage_soft_cap: number
  warning_cap: number
  plan_status: string
  ramp_back_week: number
  estimated_capacity: number
  created_at: string
  updated_at: string
}
