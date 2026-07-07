/**
 * Minimal line-icon catalog for custom activities, replacing the emoji picker.
 * Stroke-based 24×24 shapes rendered by `ActivityIcon`; they inherit
 * `currentColor` so they pick up accent / muted colours from the parent.
 *
 * PRIMARY ids are the top exercises people track — simple figure pictograms —
 * shown first in the Settings picker. MORE ids are equipment / generic marks
 * behind the "More icons" toggle.
 *
 * The `custom_activities.emoji` column stores one of these ids for new
 * activities; values that aren't a known id (e.g. legacy emojis) render as
 * plain text so old rows keep working.
 */

export type ActivityIconShape = {
  label: string
  paths: string[]
  circles?: { cx: number; cy: number; r: number }[]
}

const ICONS = {
  // --- Top exercises (figure pictograms) ---------------------------------
  pullup: {
    label: 'Pull-ups',
    paths: [
      'M3 5h18',
      'M7.5 5 10.6 9.4',
      'M16.5 5l-3.1 4.4',
      'M12 13.4v3.2',
      'm12 16.6-1.9 3.2',
      'm12 16.6 1.9 3.2',
    ],
    circles: [{ cx: 12, cy: 11.4, r: 2 }],
  },
  squat: {
    label: 'Squats',
    paths: [
      'M9.4 6.4 8 11.8',
      'M9 7.9h5.2',
      'M8 11.8 12.8 12',
      'M12.8 12l-.4 5.6',
      'M12.4 17.6h2.9',
    ],
    circles: [{ cx: 9, cy: 4.6, r: 1.9 }],
  },
  situp: {
    label: 'Sit-ups',
    paths: [
      'M3.5 19.5h17',
      'M11.6 19.3 8.2 13.6',
      'M11.6 19.3l3.6-4.4',
      'M15.2 14.9l2.2 4.4',
      'M9.3 14.9l3.3 1.5',
    ],
    circles: [{ cx: 7.4, cy: 11.9, r: 1.9 }],
  },
  dip: {
    label: 'Dips',
    paths: [
      'M3.5 11h5',
      'M15.5 11h5',
      'M12 6.5V13',
      'M12 7.6 8.5 11',
      'M12 7.6l3.5 3.4',
      'M12 13l-1.6 3.4 1.1 3',
    ],
    circles: [{ cx: 12, cy: 4.6, r: 1.9 }],
  },
  lunge: {
    label: 'Lunges',
    paths: [
      'M3.5 20h17',
      'M9.4 6.7v5',
      'M9.4 11.7l4.2 1.2',
      'M13.6 12.9V18',
      'M13.6 18h2.6',
      'M9.4 11.7l-3 5.1',
      'M6.4 16.8 4.1 18.1',
    ],
    circles: [{ cx: 9.4, cy: 4.8, r: 1.9 }],
  },
  plank: {
    label: 'Plank',
    paths: [
      'M3.5 19h17',
      'M7.3 13.6 18.6 16.2',
      'M9.5 14.1V19',
      'M9.5 19h3.4',
      'M18.6 16.2l.7 2.8',
    ],
    circles: [{ cx: 5.4, cy: 12.8, r: 1.9 }],
  },
  calfraise: {
    label: 'Calf raises',
    paths: [
      'M6 19.5h12.5',
      'M12.6 4v9.3',
      'M12.6 13.3l-1.2 2.3',
      'M11.4 15.6l3.6 3.9',
      'm5.5 9.5 2-2 2 2',
    ],
  },
  legraise: {
    label: 'Leg raises',
    paths: ['M3.5 20h17', 'M7.2 17.8h6.6', 'M13.8 17.8V8.6'],
    circles: [{ cx: 5.2, cy: 17, r: 1.9 }],
  },
  jumpingjack: {
    label: 'Jumping jacks',
    paths: [
      'M12 6.6v5.2',
      'M12 8.2 7.6 5.2',
      'M12 8.2l4.4-3',
      'M12 11.8l-3.6 5.6',
      'M12 11.8l3.6 5.6',
    ],
    circles: [{ cx: 12, cy: 4.6, r: 2 }],
  },
  dumbbell: {
    label: 'Dumbbell curls',
    paths: [
      'M14.4 14.4 9.6 9.6',
      'M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l1.767-1.768a2 2 0 1 1 2.828 2.828z',
      'm21.5 21.5-1.4-1.4',
      'M3.9 3.9 2.5 2.5',
      'M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z',
    ],
  },

  // --- More: equipment + generic marks -----------------------------------
  barbell: {
    label: 'Barbell',
    paths: [
      'M6.5 6.5v11',
      'M3.5 8.5v7',
      'M17.5 6.5v11',
      'M20.5 8.5v7',
      'M6.5 12h11',
      'M2 12h1.5',
      'M20.5 12H22',
    ],
  },
  kettlebell: {
    label: 'Kettlebell',
    paths: ['M9.2 10.7c-1.2-3.4.3-6.2 2.8-6.2s4 2.8 2.8 6.2'],
    circles: [{ cx: 12, cy: 15.2, r: 5.3 }],
  },
  rope: {
    label: 'Jump rope',
    paths: ['M5 13.5c0-5 3-8.5 7-8.5s7 3.5 7 8.5', 'M5 13.5V19', 'M19 13.5V19'],
  },
  bolt: {
    label: 'Bolt',
    paths: [
      'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
    ],
  },
  flame: {
    label: 'Flame',
    paths: [
      'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    ],
  },
  heartbeat: {
    label: 'Heart rate',
    paths: [
      'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
      'M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27',
    ],
  },
  mountain: {
    label: 'Mountain',
    paths: ['m8 3 4 8 5-5 5 15H2L8 3z'],
  },
  target: {
    label: 'Target',
    paths: [],
    circles: [
      { cx: 12, cy: 12, r: 10 },
      { cx: 12, cy: 12, r: 6 },
      { cx: 12, cy: 12, r: 2 },
    ],
  },
  waves: {
    label: 'Waves',
    paths: [
      'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
      'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
      'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
    ],
  },
  star: {
    label: 'Star',
    paths: [
      'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
    ],
  },
} satisfies Record<string, ActivityIconShape>

export type ActivityIconId = keyof typeof ICONS

export const ACTIVITY_ICON_IDS = Object.keys(ICONS) as ActivityIconId[]

/** Top exercises most people track — shown first in the picker. */
export const PRIMARY_ACTIVITY_ICON_IDS: ActivityIconId[] = [
  'pullup',
  'squat',
  'situp',
  'dip',
  'lunge',
  'plank',
  'calfraise',
  'legraise',
  'jumpingjack',
  'dumbbell',
]

/** Equipment + generic marks, behind the "More icons" toggle. */
export const MORE_ACTIVITY_ICON_IDS: ActivityIconId[] = ACTIVITY_ICON_IDS.filter(
  (id) => !PRIMARY_ACTIVITY_ICON_IDS.includes(id),
)

/** Icon id used for the built-in push-ups activity (brand bolt). */
export const PUSHUPS_ICON: ActivityIconId = 'bolt'

export function isActivityIconId(value: string): value is ActivityIconId {
  return value in ICONS
}

export function getActivityIconShape(icon: string): ActivityIconShape | null {
  return isActivityIconId(icon) ? ICONS[icon] : null
}

export function activityIconLabel(icon: string): string {
  return getActivityIconShape(icon)?.label ?? icon
}
