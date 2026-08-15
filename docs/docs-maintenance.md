# PushUS documentation maintenance

How we keep public docs clean while the project moves fast.

**Rule for Cursor and humans:** update README, CHANGELOG, roadmap, and dev-log **as you go** — in the same batch as the code. See also `.cursor/rules/documentation.mdc` and `.cursor/rules/versioning.mdc`.

---

## File roles

| File | Use for | Do not use for |
|------|---------|----------------|
| [README.md](../README.md) | Stable public-facing overview; implemented checklist; release status table | Daily fixes, Cursor task noise |
| [CHANGELOG.md](../CHANGELOG.md) | Meaningful user-facing or ops changes (Unreleased → release section) | Every tiny commit |
| [docs/dev-log.md](./dev-log.md) | Daily progress; weekly/monthly rollups | Locked product law |
| [docs/product-decisions.md](./product-decisions.md) | Locked Q&A decisions | Speculative ideas |
| [docs/product-roadmap.md](./product-roadmap.md) | Future direction and non-goals; mark items implemented | Implementation tickets |
| [docs/implementation-plan.md](./implementation-plan.md) | Engineering slices and test gates | Marketing copy |

---

## Workflow (ongoing — not end-of-week only)

### On every meaningful change

1. **CHANGELOG** — add under `## Unreleased` (or the active release section if mid-release).
2. **dev-log** — short daily note when useful (Shipped / Fixed / Security / Notes / Next).
3. **README** — tick `Implemented` items and update status when users would notice.
4. **product-roadmap** — move shipped ideas from future lists to implemented.
5. **product-decisions** — when Rhys locks a rule in planning.

### Rollups

6. **End of week** — summarise daily notes into **Weekly summaries** in dev-log.
7. **End of month** — summarise weeks into **Monthly summaries**.

### README discipline

- Do not dump every tiny fix into README.
- Update when public positioning, status labels, or top-level feature lists change.

---

## Versioning

### Source of truth

`package.json` `version` field (semver).

### Must match on release

| File | Check |
|------|-------|
| `package.json` | `version` |
| `package-lock.json` | root `version` |
| `CHANGELOG.md` | latest `## [x.y.z]` heading |
| `README.md` | `**v{x.y.z}**` in Current status |
| `src/lib/whatsNew.ts` | `version` set on this release's new items (≤ 3 may stay unversioned) |
| Git tag | `v{x.y.z}` |
| GitHub Release | `v{x.y.z}` published and marked Latest (required — not tag-only) |
| Built `version.json` | `version` + `buildId` (from Vite build) |

### Commands

```bash
npm run precommit:check  # local pre-commit hook (version + doc staging)
npm run version:check    # CI gate — all of the above except git tag
npm run version:bump -- patch   # or minor / major
```

### Pre-commit hook (local)

After `npm install`, Husky runs `npm run precommit:check` before each commit:

1. **`version:check`** — package, lockfile, CHANGELOG latest heading, and README status row must match, **and** no more than `MAX_UNVERSIONED_NEWS` (3) `src/lib/whatsNew.ts` items may lack a `version`.
2. **`check-docs-staged`** — if you stage user-visible code (`src/pages`, `src/components`, `src/hooks`, `supabase/migrations`, `supabase/functions`), you must also stage at least one doc file (`CHANGELOG.md`, `docs/dev-log.md`, `README.md`, etc.) in the same commit.

This does **not** bump semver on every commit — only enforces alignment and doc pairing. Use `version:bump` when cutting a release.

`version:bump` runs `npm version`, then **moves** the current CHANGELOG `## Unreleased` notes into a new `## [x.y.z]` release section (it no longer discards them). You still update README / whatsNew versions / roadmap / dev-log before commit.

### Don't let versions stall (the "still under 1.2" guard)

A **What's New** item (`src/lib/whatsNew.ts`) is only added when a **headline** feature ships. Each such item carries a `version` string once released. The `version:check` guard fails once **more than 3** items sit unversioned — the signal that you've shipped a batch of headline features but never cut a release. When it trips: run `npm run version:bump -- minor`, then set `version: 'x.y.z'` on the new release's items. This is the mechanism that stops many launches from piling up under one stale version.

### Release checklist

1. `npm run version:bump -- patch` (or minor/major) — moves Unreleased notes into the new section
2. Skim the new CHANGELOG release section
3. README — new `**vX.Y.Z**` status row (latest)
4. `src/lib/whatsNew.ts` — set `version: 'X.Y.Z'` on this release's new items
5. roadmap / product-decisions / dev-log as needed
6. `npm run version:check && npm test`
7. Commit and push the release commit
8. `git tag -a vX.Y.Z -m "vX.Y.Z"` and `git push origin vX.Y.Z`
9. Create the GitHub Release (required — incomplete without this):

```bash
gh release create vX.Y.Z --title "PushUS vX.Y.Z" --notes-file path/to/changelog-section.md --latest
```

Use that version's `## [X.Y.Z]` body from `CHANGELOG.md` as the notes. Confirm GitHub shows **Latest** on `vX.Y.Z`.

### Semver

- **patch** — fixes, polish, non-breaking tweaks
- **minor** — new features, backward compatible for self-hosters
- **major** — breaking migrations or deploy assumptions

---

## What counts as CHANGELOG-worthy

- New user-visible feature or route
- Security or privacy fix users should know about
- Breaking change for self-hosters or deploy config
- Removal or deprecation of a feature
- Major performance or reliability improvement users would notice

Not CHANGELOG-worthy alone: internal refactors, test-only changes, comment edits, single-line CSS tweaks (unless user-visible).

---

## Secrets

Never commit real keys, `.env` contents, or production URLs with credentials in any doc.

Use placeholders: `VITE_SUPABASE_URL`, `YOUR_PROJECT_REF`, `API_KEY_HERE`.
