import { describe, expect, it } from 'vitest'
import { NEWS_ITEMS } from '@/lib/whatsNew'

const SEMVER_RE = /^\d+\.\d+\.\d+$/

// Guards the "50 commits still under 1.2" problem: a What's New entry is only
// added when a headline feature ships, so unversioned items piling up means we
// shipped features without cutting a release. Kept in lockstep with
// MAX_UNVERSIONED_NEWS in scripts/check-version.mjs (the pre-commit enforcer).
const MAX_UNVERSIONED_NEWS = 3

describe("What's New versioning", () => {
  it('has at most MAX_UNVERSIONED_NEWS items without a version (forces a release)', () => {
    const unversioned = NEWS_ITEMS.filter((item) => !item.version)
    expect(
      unversioned.length,
      `Unversioned items: ${unversioned.map((i) => i.id).join(', ')} — cut a release`,
    ).toBeLessThanOrEqual(MAX_UNVERSIONED_NEWS)
  })

  it('every present version is valid semver', () => {
    for (const item of NEWS_ITEMS) {
      if (item.version == null) continue
      expect(item.version, `${item.id} version`).toMatch(SEMVER_RE)
    }
  })
})
