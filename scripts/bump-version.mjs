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

const releaseBlock = `## [${version}] - ${date}\n\n### Added\n\n- (describe change)\n\n`

changelog = changelog.replace(
  /## Unreleased\n\n[\s\S]*?(?=\n---)/,
  '## Unreleased\n\n_(Nothing yet.)_',
)

const unreleasedSectionEnd = /(## Unreleased[\s\S]*?---\n\n)/

if (!unreleasedSectionEnd.test(changelog)) {
  console.error('CHANGELOG.md must have ## Unreleased followed by --- before release headings')
  process.exit(1)
}

changelog = changelog.replace(unreleasedSectionEnd, `$1${releaseBlock}---\n\n`)

writeFileSync(changelogPath, changelog.endsWith('\n') ? changelog : `${changelog}\n`, 'utf8')

console.log(`\nBumped to ${version}. Update these before commit:\n`)
console.log('- CHANGELOG.md — fill in the new release section')
console.log('- README.md — status table row for v' + version + ' (latest)')
console.log('- docs/product-roadmap.md — move shipped items to Implemented')
console.log('- docs/product-decisions.md — any new locked rules')
console.log('- docs/dev-log.md — daily note')
console.log('- git tag -a v' + version + ' -m "PushUS ' + version + '"')
console.log('- gh release create v' + version + ' (after push)')
