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
