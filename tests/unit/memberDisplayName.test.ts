import { describe, expect, it } from 'vitest'
import { formatMemberListName, formatProfileName } from '../../src/lib/memberDisplayName'

describe('formatProfileName', () => {
  it('appends a single-letter initial when set', () => {
    expect(formatProfileName({ display_name: 'Rhys', name_initial: 'e' })).toBe('Rhys E')
  })

  it('returns display name alone when initial is missing', () => {
    expect(formatProfileName({ display_name: 'Sam', name_initial: null })).toBe('Sam')
  })

  it('ignores invalid initials', () => {
    expect(formatProfileName({ display_name: 'Sam', name_initial: 'XY' })).toBe('Sam')
  })
})

describe('formatMemberListName', () => {
  it('shows alias with canonical name in brackets', () => {
    expect(
      formatMemberListName(
        { display_name: 'mk', name_initial: 'M' },
        'Michael M',
      ),
    ).toBe('Michael M (mk)')
  })

  it('falls back to profile name with initial when no alias', () => {
    expect(formatMemberListName({ display_name: 'Rhys', name_initial: 'E' }, null)).toBe(
      'Rhys E',
    )
  })
})
