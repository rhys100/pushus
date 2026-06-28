import { test, expect } from 'vitest'
import { isNewerBuild, parseAppVersionPayload } from '@/lib/appVersion'

test('parseAppVersionPayload accepts valid payload', () => {
  expect(parseAppVersionPayload({ buildId: 'abc123' })).toEqual({ buildId: 'abc123' })
  expect(parseAppVersionPayload({ buildId: 'abc123', version: '1.0.1' })).toEqual({
    buildId: 'abc123',
    version: '1.0.1',
  })
})

test('parseAppVersionPayload rejects invalid payload', () => {
  expect(parseAppVersionPayload(null)).toBeNull()
  expect(parseAppVersionPayload({ buildId: '' })).toBeNull()
  expect(parseAppVersionPayload({ version: '1' })).toBeNull()
})

test('isNewerBuild detects changed build ids', () => {
  expect(isNewerBuild('new-id', 'old-id')).toBe(true)
  expect(isNewerBuild('same-id', 'same-id')).toBe(false)
})

test('isNewerBuild ignores dev builds', () => {
  expect(isNewerBuild('prod-id', 'dev')).toBe(false)
  expect(isNewerBuild('dev', 'prod-id')).toBe(false)
})
