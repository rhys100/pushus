import { addDays, format, parseISO } from 'date-fns'

/**
 * Which past days a member may add to or edit, from the UI's point of view.
 *
 * Mirrors the server's default `today_yesterday` backdate policy: members can
 * log and correct today and yesterday; older days are locked. The server is the
 * source of truth (is_backdate_allowed + update_pushup_entry), so this only
 * gates affordances — the RPCs still reject a locked day if someone forces it.
 *
 * Dates are group-local ISO strings (`yyyy-MM-dd`), the same format the calendar
 * and day queries use.
 */
export function yesterdayIso(todayDate: string): string {
  return format(addDays(parseISO(`${todayDate}T12:00:00`), -1), 'yyyy-MM-dd')
}

/** Today or yesterday → member may add a set and edit existing sets. */
export function isEditableDay(selectedDate: string, todayDate: string): boolean {
  if (!selectedDate || !todayDate) {
    return false
  }
  return selectedDate === todayDate || selectedDate === yesterdayIso(todayDate)
}

/** Delete stays same-day for members (older corrections are edit-only). */
export function isDeletableDay(selectedDate: string, todayDate: string): boolean {
  return Boolean(selectedDate) && selectedDate === todayDate
}
