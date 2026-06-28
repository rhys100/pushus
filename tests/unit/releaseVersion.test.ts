import { expect, test } from 'vitest'
import {
  bumpSemver,
  getLatestChangelogVersion,
  parsePackageLockVersion,
  parsePackageVersion,
  readmeListsVersion,
} from '@/lib/releaseVersion'

test('parsePackageVersion reads semver from package.json', () => {
  expect(parsePackageVersion(JSON.stringify({ version: '1.0.1' }))).toBe('1.0.1')
  expect(parsePackageVersion(JSON.stringify({ version: 'bad' }))).toBeNull()
})

test('getLatestChangelogVersion reads first release heading', () => {
  const changelog = `# Changelog

## Unreleased

_(Nothing yet.)_

---

## [1.0.1] - 2026-06-28

## [1.0.0] - 2026-06-28
`
  expect(getLatestChangelogVersion(changelog)).toBe('1.0.1')
})

test('readmeListsVersion finds status table row', () => {
  expect(readmeListsVersion('| **v1.0.1** | latest |', '1.0.1')).toBe(true)
  expect(readmeListsVersion('| **v1.0.0** | beta |', '1.0.1')).toBe(false)
})

test('parsePackageLockVersion reads root package version', () => {
  const lock = JSON.stringify({
    name: 'pushus',
    version: '1.0.1',
    packages: { '': { version: '1.0.1' } },
  })
  expect(parsePackageLockVersion(lock)).toBe('1.0.1')
})

test('bumpSemver increments correctly', () => {
  expect(bumpSemver('1.0.1', 'patch')).toBe('1.0.2')
  expect(bumpSemver('1.0.1', 'minor')).toBe('1.1.0')
  expect(bumpSemver('1.0.1', 'major')).toBe('2.0.0')
})
