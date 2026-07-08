import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

// Reuse release checks via a tiny inline mirror (script runs without TS build step).
const SEMVER_RE = /^\d+\.\d+\.\d+$/
const CHANGELOG_VERSION_HEADING_RE = /^## \[(\d+\.\d+\.\d+)\]/gm

// Back-pressure against under-versioning: a "What's New" entry is only added when
// a major feature ships, so if several pile up without a `version` it means we
// shipped a batch of headline features but never cut a release (exactly the "50
// commits still under 1.2" problem this guard exists to prevent). Force a release
// before more accumulate.
const MAX_UNVERSIONED_NEWS = 3

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

/**
 * Count NEWS_ITEMS in whatsNew.ts that have no `version:` field. Parsed from
 * source text (this script has no TS build step), scoped to the array literal so
 * the `version?: string` type definition above it isn't miscounted.
 */
function countUnversionedNewsItems(text) {
  const marker = text.indexOf('NEWS_ITEMS')
  if (marker === -1) return 0
  const arrayStart = text.indexOf('[', marker)
  const arrayEnd = text.indexOf('\n]', arrayStart)
  if (arrayStart === -1 || arrayEnd === -1) return 0
  const body = text.slice(arrayStart, arrayEnd)
  const itemCount = (body.match(/\bid:\s*'/g) ?? []).length
  const versionedCount = (body.match(/\bversion:\s*'/g) ?? []).length
  return Math.max(0, itemCount - versionedCount)
}

const packageVersion = parsePackageVersion(readFileSync(join(root, 'package.json'), 'utf8'))
const lockVersion = parsePackageLockVersion(readFileSync(join(root, 'package-lock.json'), 'utf8'))
const changelogVersion = getLatestChangelogVersion(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'))
const readme = readFileSync(join(root, 'README.md'), 'utf8')
const unversionedNews = countUnversionedNewsItems(
  readFileSync(join(root, 'src/lib/whatsNew.ts'), 'utf8'),
)

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
if (unversionedNews > MAX_UNVERSIONED_NEWS) {
  errors.push(
    `${unversionedNews} "What's New" items have no \`version\` (max ${MAX_UNVERSIONED_NEWS}). ` +
      `Cut a release (npm run version:bump -- minor) and tag those items with the new version — ` +
      `don't let shipped headline features pile up under one version.`,
  )
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
