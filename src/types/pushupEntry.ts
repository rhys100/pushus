export type EntryReviewStatus = 'none' | 'pending_review' | 'approved' | 'rejected'

export type EntrySource = 'circle_logger' | 'manual_edit' | 'import'

export type PushupEntry = {
  id: string
  group_id: string
  user_id: string
  count: number
  logged_for: string
  logged_at: string
  is_backdated: boolean
  review_status: EntryReviewStatus
  source: EntrySource
  reps_in_reserve: number | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}
