const SEMVER_RE = /^\d+\.\d+\.\d+$/
const CHANGELOG_VERSION_HEADING_RE = /^## \[(\d+\.\d+\.\d+)\]/gm

export type SemverBump = 'patch' | 'minor' | 'major'

export function isSemver(version: string): boolean {
  return SEMVER_RE.test(version)
}

export function parsePackageVersion(packageJsonText: string): string | null {
  try {
    const parsed = JSON.parse(packageJsonText) as { version?: string }
    const version = parsed.version
    return typeof version === 'string' && isSemver(version) ? version : null
  } catch {
    return null
  }
}

export function parsePackageLockVersion(lockText: string): string | null {
  try {
    const parsed = JSON.parse(lockText) as {
      version?: string
      packages?: Record<string, { version?: string }>
    }
    const version = parsed.packages?.['']?.version ?? parsed.version
    return typeof version === 'string' && isSemver(version) ? version : null
  } catch {
    return null
  }
}

/** Latest tagged release heading in CHANGELOG (first `## [x.y.z]` after Unreleased). */
export function getLatestChangelogVersion(changelogText: string): string | null {
  for (const match of changelogText.matchAll(CHANGELOG_VERSION_HEADING_RE)) {
    return match[1]
  }
  return null
}

export function readmeListsVersion(readmeText: string, version: string): boolean {
  return readmeText.includes(`**v${version}**`)
}

export function bumpSemver(version: string, level: SemverBump): string {
  const [major, minor, patch] = version.split('.').map(Number)
  if (level === 'major') {
    return `${major + 1}.0.0`
  }
  if (level === 'minor') {
    return `${major}.${minor + 1}.0`
  }
  return `${major}.${minor}.${patch + 1}`
}
