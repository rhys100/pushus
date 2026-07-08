import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const bump = process.argv[2]

if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: node scripts/bump-version.mjs <patch|minor|major>')
  process.exit(1)
}

execSync(`npm version ${bump} --no-git-tag-version`, { cwd: root, stdio: 'inherit' })

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = packageJson.version
const date = new Date().toISOString().slice(0, 10)
const changelogPath = join(root, 'CHANGELOG.md')
let changelog = readFileSync(changelogPath, 'utf8')

// Capture the current Unreleased body and MOVE it into the new release section,
// rather than discarding it. The old behaviour reset Unreleased to a stub and
// dropped every accumulated note, which made cutting a release lossy (and so
// releases got skipped — the "50 commits still under 1.2" problem).
const unreleasedMatch = changelog.match(/## Unreleased\n\n([\s\S]*?)\n---/)

if (!unreleasedMatch) {
  console.error('CHANGELOG.md must have "## Unreleased" followed by content and a "---" separator')
  process.exit(1)
}

const unreleasedBody = unreleasedMatch[1].trim()
const isEmpty = unreleasedBody === '' || unreleasedBody === '_(Nothing yet.)_'
const releaseBody = isEmpty ? '### Added\n\n- (describe change)' : unreleasedBody

// Function replacer so a `$` in the notes isn't treated as a replacement token.
changelog = changelog.replace(
  /## Unreleased\n\n[\s\S]*?\n---/,
  () =>
    `## Unreleased\n\n_(Nothing yet.)_\n\n---\n\n## [${version}] - ${date}\n\n${releaseBody}\n\n---`,
)

writeFileSync(changelogPath, changelog.endsWith('\n') ? changelog : `${changelog}\n`, 'utf8')

console.log(
  `\nBumped to ${version}. Unreleased notes were moved into the new [${version}] section.\n`,
)
console.log('Finish the release before commit:')
console.log('- CHANGELOG.md — skim the new [' + version + '] section reads right')
console.log('- README.md — add a **v' + version + '** row (latest) to Current status')
console.log("- src/lib/whatsNew.ts — set version: '" + version + "' on this release's new items")
console.log('- docs/product-roadmap.md — move shipped items to Implemented')
console.log('- docs/product-decisions.md — any new locked rules')
console.log('- docs/dev-log.md — daily note')
console.log('- git tag -a v' + version + ' -m "PushUS ' + version + '"')
console.log('- gh release create v' + version + ' (after push)')
