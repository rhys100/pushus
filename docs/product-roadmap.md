# PushUS product roadmap

Public-friendly view of where PushUS is today and where it may go.

- **Locked decisions:** [product-decisions.md](./product-decisions.md)
- **Engineering slices:** [implementation-plan.md](./implementation-plan.md)
- **Release notes:** [CHANGELOG.md](../CHANGELOG.md)

---

## Implemented now

### Core

- Magic link auth; optional Google OAuth
- Profile onboarding (name, emoji, timezone)
- Private beta allowlist
- Private groups, invite links/codes, join workflows, roles (owner/admin/member)

### Logging

- Direct-drag circular logger (no plus button); one lap = 10 push-ups
- Bank Push-ups, undo, edit/delete entries, daily total, entry audit foundation
- Per-rep haptic tick while dragging (where the browser supports vibration)
- Handle snap animation on each rep during drag

### Social and group

- Weekly leaderboard
- Activity feed with emoji reactions (🔥 💪 👏 in beta)
- Invite tools and member management

### Platform

- Supabase + RLS; Community mode (billing off)
- Static SPA deployable to Cloudflare Pages (and similar hosts)
- AGPL-3.0-only
- Optional web push reminders (once per day when behind goal)

---

## Near-term beta priorities

Focus before expanding scope:

- Mobile UI polish
- Security hardening and RLS test coverage
- Speed and snappiness on real phones
- Invite flow clarity (link primary, code backup)
- Production deployment documentation
- Self-hosting guide expansion
- Operator runbooks (private beta, push reminders)

---

## Planned

Not all implemented — see [product-decisions.md](./product-decisions.md) for rules.

- **Friend/mate connections** — consent-based graph, not public discovery
- Friend profile cards and mate-vs-mate views
- **1v1 challenges** and friend nudges
- Richer challenge types (one-day, weekend, 7/14/30-day, custom; team totals)
- Training and safety wizard (skippable; five questions; caps and ramp-back)
- Streaks, XP, achievements, admin banter badges
- Expanded push reminders (frequency options, banter opt-in)
- Better group admin and moderation tools
- **PushUS Cloud** — official hosted edition with group billing

---

## Ideas under consideration

Explore later; not locked:

- Friend nudges and “stir them up” reactions
- Mate-vs-mate leaderboard
- Custom banter badges beyond catalog
- Larger team challenge formats
- Club mode (multiple groups / org framing)
- Public marketing landing page separate from app
- User data export/import for self-hosters

---

## Non-goals

We are not building these in early versions:

- Public social network or global public leaderboard
- Public user discovery or search
- Direct messages
- Comments on feed entries
- Phone contact or address book import
- Profile photos by default
- Proof videos or photos for reps
- Per-user billing
- Anonymous nickname-only accounts

---

## Product principle

PushUS is a **private mates/group challenge app**.

Any future social feature must preserve private groups, avoid public discovery by default, avoid DMs early, minimise personal data, and pass an RLS review before ship.

---

## Detailed roadmap notes

Older detailed sections (auth, entry rules, commercial defaults, notification phases) remain documented in [product-decisions.md](./product-decisions.md). This file stays readable for visitors; the decision log holds exact rules.

---

## Maintenance

Roadmap ideas start here or in dev-log; locked decisions move to product-decisions. Do not mirror the full decision log in README.

See [docs-maintenance.md](./docs-maintenance.md).
