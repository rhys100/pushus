import { execSync } from 'node:child_process'

/**
 * Pre-commit gate: user-visible code changes must include a doc update in the same commit.
 * See .cursor/rules/documentation.mdc and docs/docs-maintenance.md
 */

const DOC_PATHS = [
  'CHANGELOG.md',
  'README.md',
  'docs/dev-log.md',
  'docs/product-roadmap.md',
  'docs/product-decisions.md',
]

const USER_VISIBLE_PATTERNS = [
  /^src\/pages\//,
  /^src\/components\//,
  /^src\/hooks\//,
  /^supabase\/migrations\//,
  /^supabase\/functions\//,
]

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const staged = getStagedFiles()

if (staged.length === 0) {
  process.exit(0)
}

const hasUserVisibleChange = staged.some((file) =>
  USER_VISIBLE_PATTERNS.some((pattern) => pattern.test(file)),
)

const hasDocChange = staged.some(
  (file) =>
    DOC_PATHS.includes(file) ||
    file.startsWith('docs/') ||
    file.startsWith('.cursor/rules/'),
)

if (hasUserVisibleChange && !hasDocChange) {
  console.error('Documentation check failed for staged changes.\n')
  console.error(
    'User-visible code changed (src/pages, src/components, src/hooks, supabase migrations/functions)',
  )
  console.error('but no doc file was staged in this commit.\n')
  console.error('Stage at least one of:')
  for (const path of DOC_PATHS) {
    console.error(`  - ${path}`)
  }
  console.error('\nSee docs/docs-maintenance.md and .cursor/rules/documentation.mdc')
  process.exit(1)
}

console.log('Documentation staging check OK')
