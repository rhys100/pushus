import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import {
  getLatestChangelogVersion,
  parsePackageLockVersion,
  parsePackageVersion,
  readmeListsVersion,
} from '@/lib/releaseVersion'

const root = join(__dirname, '../../')

function readRepoFile(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

test('package.json, CHANGELOG, package-lock, and README agree on release version', () => {
  const packageVersion = parsePackageVersion(readRepoFile('package.json'))
  const lockVersion = parsePackageLockVersion(readRepoFile('package-lock.json'))
  const changelogVersion = getLatestChangelogVersion(readRepoFile('CHANGELOG.md'))
  const readme = readRepoFile('README.md')

  expect(packageVersion, 'package.json must contain a semver version').not.toBeNull()
  expect(lockVersion, 'package-lock.json root version must match package.json').toBe(packageVersion)
  expect(changelogVersion, 'CHANGELOG must have a latest release heading').not.toBeNull()
  expect(changelogVersion).toBe(packageVersion)
  expect(readmeListsVersion(readme, packageVersion!), 'README status table must list v{version}').toBe(
    true,
  )
})
