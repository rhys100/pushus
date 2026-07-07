export type ActivitySide = 'left' | 'right'

export type CustomActivity = {
  id: string
  user_id: string
  name: string
  emoji: string
  track_sides: boolean
  position: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type CustomActivityEntry = {
  id: string
  activity_id: string
  user_id: string
  count: number
  side: ActivitySide | null
  logged_for: string
  logged_at: string
  created_at: string
  updated_at: string
}
