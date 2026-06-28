import { describe, expect, it } from 'vitest'
import { isBackdateAllowed } from '../../src/lib/backdatePolicy'

const d = (iso: string) => new Date(`${iso}T12:00:00`)

describe('backdatePolicy', () => {
  const today = d('2026-06-25')
  const yesterday = d('2026-06-24')
  const lastWeek = d('2026-06-16')

  it('always allows logging for today', () => {
    expect(isBackdateAllowed('same_day', today, today)).toBe(true)
    expect(isBackdateAllowed('today_yesterday', today, today)).toBe(true)
    expect(isBackdateAllowed('this_week', today, today)).toBe(true)
  })

  it('same_day policy rejects any other day', () => {
    expect(isBackdateAllowed('same_day', today, yesterday)).toBe(false)
  })

  it('today_yesterday allows yesterday only', () => {
    expect(isBackdateAllowed('today_yesterday', today, yesterday)).toBe(true)
    expect(isBackdateAllowed('today_yesterday', today, lastWeek)).toBe(false)
  })

  it('this_week allows dates within the current Monday–today window', () => {
    const monday = d('2026-06-23')

    expect(isBackdateAllowed('this_week', today, monday)).toBe(true)
    expect(isBackdateAllowed('this_week', today, lastWeek)).toBe(false)
  })
})
