import { format, parseISO } from 'date-fns'

/** Entry timestamp as a short local time (e.g. "7:05 AM"); em-dash on parse failure. */
export function formatEntryTime(iso: string): string {
  try {
    return format(parseISO(iso), 'h:mm a')
  } catch {
    return '—'
  }
}

export function formatSelectedDayLabel(selectedDate: string, todayDate: string): string {
  if (!selectedDate || selectedDate === todayDate) {
    return 'Today'
  }

  try {
    return format(parseISO(`${selectedDate}T12:00:00`), 'EEE d MMM')
  } catch {
    return selectedDate
  }
}
