import { format, parseISO } from 'date-fns'

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
