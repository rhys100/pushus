import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

// Reuse release checks via a tiny inline mirror (script runs without TS build step).
const SEMVER_RE = /^\d+\.\d+\.\d+$/
const CHANGELOG_VERSION_HEADING_RE = /^## \[(\d+\.\d+\.\d+)\]/gm

function parsePackageVersion(text) {
  const version = JSON.parse(text).version
  return typeof version === 'string' && SEMVER_RE.test(version) ? version : null
}

function parsePackageLockVersion(text) {
  const parsed = JSON.parse(text)
  const version = parsed.packages?.['']?.version ?? parsed.version
  return typeof version === 'string' && SEMVER_RE.test(version) ? version : null
}

function getLatestChangelogVersion(text) {
  for (const match of text.matchAll(CHANGELOG_VERSION_HEADING_RE)) {
    return match[1]
  }
  return null
}

function readmeListsVersion(text, version) {
  return text.includes(`**v${version}**`)
}

const packageVersion = parsePackageVersion(readFileSync(join(root, 'package.json'), 'utf8'))
const lockVersion = parsePackageLockVersion(readFileSync(join(root, 'package-lock.json'), 'utf8'))
const changelogVersion = getLatestChangelogVersion(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'))
const readme = readFileSync(join(root, 'README.md'), 'utf8')

const errors = []

if (!packageVersion) {
  errors.push('package.json has no valid semver version')
}
if (packageVersion && lockVersion !== packageVersion) {
  errors.push(`package-lock.json version (${lockVersion}) must match package.json (${packageVersion})`)
}
if (packageVersion && changelogVersion !== packageVersion) {
  errors.push(
    `CHANGELOG latest release (${changelogVersion}) must match package.json (${packageVersion})`,
  )
}
if (packageVersion && !readmeListsVersion(readme, packageVersion)) {
  errors.push(`README.md must include **v${packageVersion}** in the status table`)
}

if (errors.length > 0) {
  console.error('Version consistency check failed:\n')
  for (const error of errors) {
    console.error(`  - ${error}`)
  }
  console.error('\nRun npm run version:bump or update files manually. See docs/docs-maintenance.md')
  process.exit(1)
}

console.log(`Version OK: ${packageVersion}`)
