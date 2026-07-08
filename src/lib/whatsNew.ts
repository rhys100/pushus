/**
 * "What's new" feature announcements. Add an entry at the TOP of NEWS_ITEMS
 * when a major feature ships — returning members see one popup with every
 * item they haven't seen yet. Members who joined after a feature launched
 * never see it (it was always there for them).
 */

export type NewsItem = {
  /** Stable slug, e.g. '2026-07-07-custom-activities'. Never reuse or rename. */
  id: string
  /** Launch date (yyyy-MM-dd) — items older than the member's join date are skipped. */
  date: string
  /** App version the feature shipped in — shown in the Settings history. */
  version?: string
  /** An ActivityIconId (preferred, see lib/activityIcons) or a literal emoji. */
  emoji: string
  title: string
  body: string
}

/** Beta sign-off shown on the popup and the Settings history page. */
export const WHATS_NEW_SIGNOFF = 'Love Rhys + MK 🧡'

/** Newest first. */
export const NEWS_ITEMS: NewsItem[] = [
  {
    id: '2026-07-07-mates',
    date: '2026-07-07',
    version: '1.3.0',
    emoji: '🤝',
    title: 'Mates, nudges, and 1v1 battles',
    body: 'Add mates from your group or share your mate link. Compare stats, nudge them (💪 push, 👏 cheer, 😤 stir), and go head to head in 1, 3, or 7-day battles. Find it on the Group tab.',
  },
  {
    id: '2026-07-07-challenges',
    date: '2026-07-07',
    version: '1.3.0',
    emoji: '🏆',
    title: 'Group challenges',
    body: 'Admins can now run one-day, weekend, week-long, or team-vs-team challenges. Join from the Challenges page — late joiners score from the day they join, so no sneaky backfilled wins.',
  },
  {
    id: '2026-07-07-xp-badges-streaks',
    date: '2026-07-07',
    version: '1.3.0',
    emoji: '🏅',
    title: 'XP, badges, and streaks',
    body: 'Every push-up now earns 1 XP, badges unlock automatically (your history already counts), and your streak shows on the Badges page — with one freeze a week to protect a missed day.',
  },
  {
    id: '2026-07-07-light-mode',
    date: '2026-07-07',
    version: '1.3.0',
    emoji: '🌗',
    title: 'Light mode',
    body: 'PushUS now follows your phone theme, or pick Light/Dark in Settings → Appearance.',
  },
  {
    id: '2026-07-07-reminder-fix',
    date: '2026-07-07',
    version: '1.3.0',
    emoji: 'bolt',
    title: 'Reminders that actually ding',
    body: 'Hourly reminders were silently updating the old notification instead of making noise. Fixed — plus new frequencies from every 30 minutes to once a day in Settings.',
  },
  {
    id: '2026-07-07-custom-activities',
    date: '2026-07-07',
    version: '1.2.0',
    emoji: 'barbell',
    title: 'Custom activities',
    body: 'Track any exercise just for you — calf raises, pull-ups, leg raises — with optional left/right sides. Add one in Settings, then swap from the pill above the ring.',
  },
  {
    id: '2026-07-07-progress-chart',
    date: '2026-07-07',
    version: '1.2.0',
    emoji: 'mountain',
    title: 'My progress chart',
    body: 'The Board now charts your daily and weekly trend for push-ups and custom activities — switch to Best set to watch your max climb over time.',
  },
  {
    id: '2026-07-07-board-privacy',
    date: '2026-07-07',
    version: '1.2.0',
    emoji: 'target',
    title: 'Show your rep totals',
    body: 'New Settings toggle: let group mates see your actual reps on the day board instead of a percentage.',
  },
  {
    id: '2026-07-07-plus-ten',
    date: '2026-07-07',
    version: '1.2.0',
    emoji: 'bolt',
    title: '+10 quick add',
    body: 'Banking sets of 10? Tap +10 under the ring instead of dragging a full lap.',
  },
]

export function latestNewsId(items: NewsItem[] = NEWS_ITEMS): string | null {
  return items[0]?.id ?? null
}

/**
 * Items the member hasn't seen yet. `lastSeenId` marks everything from that
 * item onwards as seen; items launched before the member's profile existed
 * are never news to them.
 */
export function unseenNewsItems(
  items: NewsItem[],
  lastSeenId: string | null,
  profileCreatedAt?: string | null,
): NewsItem[] {
  let candidates: NewsItem[]

  if (lastSeenId == null) {
    candidates = items
  } else {
    const seenIndex = items.findIndex((item) => item.id === lastSeenId)
    candidates = seenIndex === -1 ? items : items.slice(0, seenIndex)
  }

  if (!profileCreatedAt) {
    return candidates
  }

  const joinedDate = profileCreatedAt.slice(0, 10)
  return candidates.filter((item) => item.date >= joinedDate)
}
