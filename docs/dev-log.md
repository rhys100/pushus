# PushUS dev log

Working notes while building PushUS. This file is **not** the public README.

For release-level summaries, see [CHANGELOG.md](../CHANGELOG.md).

For locked product rules, see [product-decisions.md](./product-decisions.md).

For future ideas, see [product-roadmap.md](./product-roadmap.md).

Maintenance rules: [docs-maintenance.md](./docs-maintenance.md).

---

## How this log works

- **Daily notes** are temporary working notes (newest first).
- At the **end of each week**, roll daily notes into a **Weekly summary** and trim noise from Daily notes.
- At the **end of each month**, roll weekly summaries into a **Monthly summary**.
- **Important product/security decisions** move to [product-decisions.md](./product-decisions.md).
- **Roadmap ideas** move to [product-roadmap.md](./product-roadmap.md).
- **Public release-worthy changes** move to [CHANGELOG.md](../CHANGELOG.md).
- Keep the [README](../README.md) stable and public-facing — no daily dump here.

---

## Daily notes

### 2026-06-28 (reminder frequency)

- Added `reminder_interval_hours` to `notification_preferences` (1, 2, or 24)
- Settings: frequency picker (hourly / every 2 hours / once per day)
- Default active hours for new users: 7am–7pm; existing users unchanged until they edit Settings
- Eligibility logic updated in `notificationEligibility.ts` and `send-push-reminders` edge function

### 2026-06-28 (v1.0.1)

#### Shipped

- Per-rep haptic feedback on circular logger drag (`repHaptic.ts`, `useCircularCounter`)
- Handle snap animation on each rep while dragging
- Docs: README, CHANGELOG 1.0.1, roadmap, product-decisions

#### Fixed

- (none)

#### Security

- (none)

#### Notes / decisions

- Multi-rep fast drags now pulse up to six ticks; single rep = one short vibrate
- iOS Safari web typically has no vibration API — visual snap is the fallback

#### Next

- Deploy and phone spot-check on Android

### 2026-06-28 (v1.0.0)

#### Shipped

- **v1.0.0** — first public release tag; git history squashed to single clean commit on `main`
- Complete product decision log
- Public README, CHANGELOG, dev log, and docs maintenance workflow

#### Fixed

- (none — release packaging)

#### Security

- (none — release packaging)

#### Notes / decisions

- Previous granular commits removed from public `main` history by design
- Detailed build history preserved in this dev log and CHANGELOG

#### Next

- Mate phone spot-checks; near-term beta priorities on roadmap

### 2026-06-28

#### Shipped

- Public docs structure: README refresh, CHANGELOG, dev log, docs maintenance guide
- Product decision log and roadmap docs (prior commits)

#### Fixed

- (none today — docs-only pass)

#### Security

- (none today — docs-only pass)

#### Notes / decisions

- README stays polished; progress rolls up via CHANGELOG + dev log
- Friend/mate connections remain roadmap-only — documented explicitly

#### Next

- Continue beta polish, security, and self-hosting guide expansion

---

## Weekly summaries

### Week of 2026-06-22

#### Highlights

- First PushUS Community beta on Cloudflare Pages with Supabase backend
- Core loop live: logger, bank, leaderboard, activity, invites, private beta gate
- Push reminders shipped; performance and security hardening passes

#### Shipped

- Initial open-source release (Slice 1A core)
- Private beta access controls and invite workflow improvements
- Auto-join via invite code (beta behaviour)
- Web push reminders and notification preferences
- Mobile UI hardening and snappiness optimisation
- App update checker for stale PWA shells
- Security hardening migrations and expanded RLS tests

#### Fixed

- Login routing, member list visibility, Today mobile overlap, notification prefs RLS
- Auth hydration and session persistence on mobile

#### Security / privacy

- Push cron authentication, groups billing column tampering fix, CDN headers, access RPC hardening

#### Open issues

- Phase 2 features (training, challenges, gamification) stubbed but not beta-ready
- Invite slot enforcement (3 referrals per member) not yet enforced in UI
- Self-hosting guide could be more step-by-step for new fork owners

#### Next week

- Public documentation polish
- Rhys spot-check with mates on phones
- Continue near-term beta priorities from roadmap

---

## Monthly summaries

_(None yet — first month in progress.)_

### Template for future use

#### Summary

-

#### Major improvements

-

#### Product decisions

-

#### Security / reliability

-

#### Roadmap changes

-
