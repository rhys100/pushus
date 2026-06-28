/** Curated IANA timezones for profile and group setup */
export const COMMON_TIMEZONES = [
  'Pacific/Auckland',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'UTC',
] as const

export function detectTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (COMMON_TIMEZONES.includes(detected as (typeof COMMON_TIMEZONES)[number])) {
      return detected
    }
    return detected || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function timezoneOptions(): string[] {
  const detected = detectTimezone()
  const set = new Set<string>([...COMMON_TIMEZONES])
  if (detected) set.add(detected)
  return Array.from(set).sort()
}
