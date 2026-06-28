# PushUS implementation plan

Technical slice gates, migrations, and engineering scope.

**This document is not the full product roadmap.**

---

## Product roadmap vs beta scope

- The **implementation plan** describes how to build and gate releases — slices, RLS, billing, tests.
- The **product roadmap** describes where PushUS could go — friend connections, challenges, gamification, Cloud go-live.
- **Current beta is group-first.** Mates connect through private groups, invite links, leaderboard, activity feed, and reactions.
- **Friend / mate connection** is a **future roadmap area** — not missing because it was deleted; it was never part of beta scope.
- See [product-roadmap.md](./product-roadmap.md) for future social and mate-graph ideas.
- See [product-decisions.md](./product-decisions.md) for locked business rules (invite limits, late joiners, streaks, caps, etc.).
- **Do not implement friend connections** until after beta stability, security hardening, and core loop validation.

---

## Slice overview

| Slice / phase | Focus | Beta status |
|---------------|-------|-------------|
| **Slice 1A** | Auth, groups, RLS gate, logger, bank/undo, weekly leaderboard, activity feed | Shipped |
| **Slice 1B** | Stripe billing, `can_group_write` extension, Cloud checkout | Code in repo; **not enabled** for Community beta |
| **Slice 1C** | Mobile polish, About/source, smoke tests, production readiness | Partial — ongoing polish passes |
| **Phase 2** | Training wizard, challenges, gamification, injury/sub-out | Schema + stubs; not beta-ready |
| **Phase 3** | Web Push reminders | Shipped (ahead of full Phase 2 polish) |
| **Phase 4** | E2E, demo seed, CI, fork ergonomics | Partial |
| **Post-beta** | Friend connections, full challenge flows, Cloud go-live | Roadmap — see product-roadmap.md |

---

## Gates (do not conflate)

| Gate | When | Blocks |
|------|------|--------|
| **RLS hard gate (Slice 1A)** | Before group-data UI | Pending members seeing private group data |
| **Billing write gate (Slice 1B)** | Before PushUS Cloud launch | Paid Cloud without Stripe, RLS, and billing tests |

Community beta requires the RLS gate only. Billing gate is for Cloud launch.

---

## Test commands

```bash
supabase db reset && npm run test && npm run test:rls    # Slice 1A gate
npm run test:billing                                      # Slice 1B gate (Cloud)
npm run test:e2e                                          # Slice 1C / Phase 4
```

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [product-roadmap.md](./product-roadmap.md) | Future features and non-goals |
| [product-decisions.md](./product-decisions.md) | Locked product rules |
| [community-beta.md](./community-beta.md) | Community beta deployment checklist |
| [billing.md](./billing.md) | Billing architecture |
| [security.md](./security.md) | RLS and secrets |
| [notifications.md](./notifications.md) | Push reminders |

The full original greenfield technical plan (tokens, schema detail, work packages) lives in the Cursor project plan file `push-ups_app_build_669740a3.plan.md` when working in Cursor. Repo docs above are the maintained source of truth for product direction and beta scope.
