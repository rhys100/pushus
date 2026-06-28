# PushUS documentation maintenance

How we keep public docs clean while the project moves fast.

---

## File roles

| File | Use for | Do not use for |
|------|---------|----------------|
| [README.md](../README.md) | Stable public-facing overview | Daily fixes, Cursor task noise |
| [CHANGELOG.md](../CHANGELOG.md) | Meaningful user-facing or ops changes | Every tiny commit |
| [docs/dev-log.md](./dev-log.md) | Daily progress; weekly/monthly rollups | Locked product law |
| [docs/product-decisions.md](./product-decisions.md) | Locked Q&A decisions | Speculative ideas |
| [docs/product-roadmap.md](./product-roadmap.md) | Future direction and non-goals | Implementation tickets |
| [docs/implementation-plan.md](./implementation-plan.md) | Engineering slices and test gates | Marketing copy |

---

## Workflow for Cursor and humans

1. **Do not dump every tiny fix into README.**
2. **CHANGELOG** — add entries when something matters to users, operators, or security (grouped under Unreleased until a release tag).
3. **dev-log** — add a short daily note when useful (Shipped / Fixed / Security / Notes / Next).
4. **End of week** — summarise daily notes into **Weekly summaries** in dev-log; trim redundant daily detail.
5. **End of month** — summarise weeks into **Monthly summaries**; archive or delete noise that is fully captured upstream.
6. **product-decisions** — when Rhys locks a rule in planning, add it there (not README).
7. **product-roadmap** — when exploring future ideas, add there (not README).
8. **README** — update only when public positioning, status labels, or top-level feature lists change.

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
