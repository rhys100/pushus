import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllPages } from '@/lib/supabasePaginate'
import { csvBlob } from '@/lib/csv'
import { buildWorkoutExportCsv, workoutExportFilename } from '@/lib/workoutExport'
import { shareOrDownloadFile, type ShareOutcome } from '@/lib/downloadFile'
import { getGroupLocalDateString } from '@/hooks/useTodayData'
import type { CustomActivity, CustomActivityEntry } from '@/types/customActivity'
import type { PushupEntry } from '@/types/pushupEntry'
import type { Group } from '@/types/database'

const ENTRY_COLUMNS =
  'id, group_id, user_id, count, logged_for, logged_at, is_backdated, review_status, source, reps_in_reserve, deleted_at, created_at, updated_at'

/**
 * Mirrors the filters every other read of `pushup_entries` uses (useRepHistory,
 * useActivityProgress, useTodayData, and `leaderboard_total` in SQL). An export
 * that skipped these would surface soft-deleted and admin-rejected sets and
 * disagree with every screen the user can check it against.
 */
async function fetchAllPushups(userId: string, groupIds: string[]): Promise<PushupEntry[]> {
  if (groupIds.length === 0) {
    return []
  }

  return fetchAllPages<PushupEntry>(async (from, to) => {
    const { data, error } = await supabase
      .from('pushup_entries')
      .select(ENTRY_COLUMNS)
      .eq('user_id', userId)
      .in('group_id', groupIds)
      .is('deleted_at', null)
      .in('review_status', ['none', 'approved'])
      // Deterministic total order — offset paging over a partial order can
      // repeat or skip rows between pages.
      .order('logged_for', { ascending: true })
      .order('logged_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)

    if (error) throw error
    return (data ?? []) as PushupEntry[]
  })
}

async function fetchAllCustomEntries(userId: string): Promise<CustomActivityEntry[]> {
  return fetchAllPages<CustomActivityEntry>(async (from, to) => {
    const { data, error } = await supabase
      .from('custom_activity_entries')
      .select('id, activity_id, user_id, count, side, logged_for, logged_at, created_at, updated_at')
      .eq('user_id', userId)
      .order('logged_for', { ascending: true })
      .order('logged_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)

    if (error) throw error
    return (data ?? []) as CustomActivityEntry[]
  })
}

/** Archived activities must be included — archiving keeps history intact. */
async function fetchAllActivities(userId: string): Promise<CustomActivity[]> {
  const { data, error } = await supabase
    .from('custom_activities')
    .select('id, user_id, name, emoji, track_sides, position, archived_at, created_at, updated_at')
    .eq('user_id', userId)

  if (error) throw error
  return (data ?? []) as CustomActivity[]
}

export type WorkoutExportState = {
  exporting: boolean
  error: string | null
  lastOutcome: ShareOutcome | null
  rowCount: number | null
}

export function useWorkoutExport(
  userId: string | undefined,
  groups: Group[],
  profileTimezone: string,
) {
  const [state, setState] = useState<WorkoutExportState>({
    exporting: false,
    error: null,
    lastOutcome: null,
    rowCount: null,
  })

  const runExport = useCallback(async () => {
    if (!userId) {
      return
    }

    setState({ exporting: true, error: null, lastOutcome: null, rowCount: null })

    try {
      const groupIds = groups.map((group) => group.id)
      const [pushups, customEntries, activities] = await Promise.all([
        fetchAllPushups(userId, groupIds),
        fetchAllCustomEntries(userId),
        fetchAllActivities(userId),
      ])

      const csv = buildWorkoutExportCsv({
        pushups,
        groupsById: new Map(groups.map((group) => [group.id, group])),
        customEntries,
        activitiesById: new Map(activities.map((activity) => [activity.id, activity])),
        profileTimezone,
      })

      const rowCount = pushups.length + customEntries.length
      const filename = workoutExportFilename(getGroupLocalDateString(profileTimezone))

      const outcome = await shareOrDownloadFile({
        blob: csvBlob(csv),
        filename,
        title: 'PushUS export',
        text: 'My PushUS log',
      })

      setState({ exporting: false, error: null, lastOutcome: outcome, rowCount })
    } catch (error) {
      setState({
        exporting: false,
        error: error instanceof Error ? error.message : 'Export failed. Try again.',
        lastOutcome: null,
        rowCount: null,
      })
    }
  }, [groups, profileTimezone, userId])

  return { ...state, runExport }
}
