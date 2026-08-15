import { formatInTimeZone } from 'date-fns-tz'
import { toCsv } from '@/lib/csv'
import type { CustomActivity, CustomActivityEntry } from '@/types/customActivity'
import type { PushupEntry } from '@/types/pushupEntry'
import type { Group } from '@/types/database'

/**
 * Building the export CSV. Pure — no Supabase, no DOM — so the row shaping and
 * the timezone handling are unit-testable.
 */

export const EXPORT_HEADERS = [
  'date',
  'activity',
  'reps',
  'side',
  'group',
  'logged_at_local',
  'backdated',
  'reps_in_reserve',
] as const

export type ExportInput = {
  pushups: PushupEntry[]
  groupsById: Map<string, Group>
  customEntries: CustomActivityEntry[]
  activitiesById: Map<string, CustomActivity>
  /** Profile timezone — custom activities have no group, so they use this. */
  profileTimezone: string
}

type ExportRow = {
  sortKey: string
  cells: unknown[]
}

/**
 * `logged_for` is already a date string in the group's local timezone, assigned
 * server-side by `group_local_date` when the entry was banked. Emit it verbatim:
 * re-deriving it from `logged_at` through the device clock would shift the date
 * for anyone travelling, and silently disagree with every screen in the app.
 */
function formatLoggedAt(loggedAt: string, timezone: string): string {
  try {
    return formatInTimeZone(new Date(loggedAt), timezone, "yyyy-MM-dd HH:mm:ss")
  } catch {
    return loggedAt
  }
}

export function buildWorkoutExportRows({
  pushups,
  groupsById,
  customEntries,
  activitiesById,
  profileTimezone,
}: ExportInput): unknown[][] {
  const rows: ExportRow[] = []

  for (const entry of pushups) {
    const group = groupsById.get(entry.group_id)
    const timezone = group?.timezone ?? profileTimezone

    rows.push({
      sortKey: `${entry.logged_for}T${entry.logged_at}`,
      cells: [
        entry.logged_for,
        'Push-ups',
        entry.count,
        '',
        group?.name ?? entry.group_id,
        formatLoggedAt(entry.logged_at, timezone),
        entry.is_backdated ? 'yes' : 'no',
        entry.reps_in_reserve ?? '',
      ],
    })
  }

  for (const entry of customEntries) {
    const activity = activitiesById.get(entry.activity_id)

    rows.push({
      sortKey: `${entry.logged_for}T${entry.logged_at}`,
      cells: [
        entry.logged_for,
        // Archived activities keep their history, so a name may be missing only
        // if the activity row itself was unreadable — never guess a name.
        activity ? `${activity.emoji} ${activity.name}`.trim() : 'Custom activity',
        entry.count,
        entry.side ?? '',
        '',
        formatLoggedAt(entry.logged_at, profileTimezone),
        'no',
        '',
      ],
    })
  }

  rows.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))

  return rows.map((row) => row.cells)
}

export function buildWorkoutExportCsv(input: ExportInput): string {
  return toCsv(EXPORT_HEADERS, buildWorkoutExportRows(input))
}

export function workoutExportFilename(today: string): string {
  return `pushus-export-${today}.csv`
}
