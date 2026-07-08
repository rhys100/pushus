/**
 * Guest-mode logging — a no-account playground. Reps are stored in this
 * browser's localStorage only (no Supabase, no sync). Cleared if the user
 * clears their browser or switches devices; the guest banner says so.
 */

export type GuestEntry = {
  id: string
  count: number
  /** ISO timestamp of when it was banked. */
  ts: string
  /** Local calendar day (YYYY-MM-DD) it counts for. */
  day: string
}

const GUEST_LOG_KEY = 'pushus-guest-log'
/** Guard against a runaway localStorage entry if someone taps forever. */
const MAX_GUEST_ENTRIES = 500

/** Device-local YYYY-MM-DD (guests have no group timezone). */
export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    // fall through
  }
  return `g-${Date.now()}-${Math.round(Math.random() * 1e9)}`
}

export function readGuestLog(): GuestEntry[] {
  try {
    const raw = localStorage.getItem(GUEST_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as GuestEntry[]) : []
  } catch {
    return []
  }
}

function writeGuestLog(entries: GuestEntry[]): void {
  try {
    localStorage.setItem(GUEST_LOG_KEY, JSON.stringify(entries.slice(-MAX_GUEST_ENTRIES)))
  } catch {
    // ignore quota / private mode
  }
}

export function addGuestEntry(count: number, at: Date = new Date()): GuestEntry {
  const entry: GuestEntry = {
    id: newId(),
    count,
    ts: at.toISOString(),
    day: localDateKey(at),
  }
  writeGuestLog([...readGuestLog(), entry])
  return entry
}

export function removeGuestEntry(id: string): GuestEntry[] {
  const next = readGuestLog().filter((entry) => entry.id !== id)
  writeGuestLog(next)
  return next
}

export function clearGuestLog(): void {
  try {
    localStorage.removeItem(GUEST_LOG_KEY)
  } catch {
    // ignore
  }
}

/** Total reps banked on a given local day. */
export function guestDayTotal(entries: GuestEntry[], day: string): number {
  return entries.reduce((sum, entry) => (entry.day === day ? sum + entry.count : sum), 0)
}

/** Entries for a given local day, newest first. */
export function guestEntriesForDay(entries: GuestEntry[], day: string): GuestEntry[] {
  return entries
    .filter((entry) => entry.day === day)
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
}

export function guestAllTimeTotal(entries: GuestEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0)
}
