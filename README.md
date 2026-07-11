# PushUS

**Bank push-ups. Push your mates. Don't wreck yourself.**

PushUS is an open-source, private group push-up challenge app for mates, clubs, teams, and small groups. Log reps with a fast circular logger, bank your sets, and keep each other honest — without public leaderboards or creepy tracking.

**Licence:** [AGPL-3.0-only](LICENSE)

---

## What is PushUS?

PushUS is a **private mates and group challenge app**, not a public social network.

It is built for **quick daily logging** on your phone: drag the ring, bank your push-ups, check the leaderboard, react to your crew's activity, and move on.

- **Private groups** — invite-only, admin-controlled
- **Mobile-first** — Log screen is the hero
- **Open source** — self-host the Community edition on your own Supabase project
- **Honour system** — no proof videos or photos required

For privacy and security detail, see [docs/privacy.md](docs/privacy.md) and [docs/security.md](docs/security.md).

---

## Current status

| Label | Meaning |
|-------|---------|
| **v1.5.0** | Social notifications (mate requests / accepts / 1v1 invites / reactions), shared mate links that work signed-out, leave-a-challenge, sound-effects toggle, redesigned day-progress card, Settings split (group admin on its own page), plus more polish and audit fixes (latest) |
| **v1.4.0** | Log a set you forgot yesterday, "How PushUS works" rules + beginner primer, XP shown on every bank, reliable reminders (no stale counts), clearer availability, plus a wide accessibility, copy, and performance polish pass |
| **v1.3.0** | Mates + nudges + 1v1 battles, group challenges, XP/badges/streaks, light mode, guest mode, custom activities, reminder reliability, app-wide motion & haptics |
| **v1.2.0** | Trusted volume calibration, training plan engine v2, max check-in, effort/soreness feedback, Board day progress, SEO/social previews |
| **v1.1.0** | Training plan v2, Board day/week/month views, Log ring UX polish, Settings tab |
| **v1.0.1** | Per-rep haptic feedback on circular logger |
| **v1.0.0** | First public release (Community beta) |
| **Private beta** | Invite and allowlist-controlled access on the official deployment |
| **Community edition** | Free, self-hosted; billing disabled by default |
| **Billing disabled** | No Stripe required for Community |
| **PushUS Cloud** | Official hosted paid option — planned; code exists but not beta-enabled |

---

## Implemented

### Core

- [x] Passwordless email auth (magic link in browsers; in-app code for iOS PWA)
- [x] Optional Google auth (when configured in Supabase)
- [x] Profile onboarding (display name, optional initial, emoji, timezone)
- [x] Edit profile in Settings (display name, initial, emoji, timezone)
- [x] Personal mate labels on Group Members list (tap a mate to rename for yourself)
- [x] Private beta allowlist
- [x] Private groups
- [x] Invite links and invite codes
- [x] Admin approval / join workflows
- [x] Group roles (owner, admin, member)

### Logging

- [x] Direct-drag circular logger (no plus button)
- [x] One lap = 10 push-ups on the ring; each lap fills in a new colour, ramping cool → hot across 10 laps (up to 100 reps)
- [x] Current lap draws as a tapering comet "snake" with a glowing head at the handle
- [x] Centre tap inside ring to add one rep (hands-free logging)
- [x] Hold the ring centre for 1.5 seconds to open nose-tap mode (dismissible hint teaches the gesture)
- [x] **Bank Push-ups** CTA on the Log page (always visible; disabled at 0 reps)
- [x] Nose-tap mode: fullscreen tap-to-rep logging with your nose, with confirm sound, vibration, and four saved skins (Bricks, Classic, Ripple, Burst)
- [x] Undo after banking
- [x] Edit and delete your entries
- [x] Daily total and progress on the Log screen (progress card below ring)
- [x] Log daily set planner (bank-about target, set N of M, sets remaining)
- [x] Reps-in-reserve effort feedback on training-day banks (plan auto-tunes from RIR)
- [x] Entry audit log foundation
- [x] Per-rep ratchet tick sound and haptic while dragging (accented at 5 and 10)
- [x] Bank lock-in ritual: S-curve unwind, ascending trill, and slam with a BANKED stamp
- [x] Synthesised sound cues via Web Audio (no audio asset files; see docs/audio-spec.md)
- [x] Handle snap animation on each rep for tactile feedback

### Social and group

- [x] Leaderboard (day, week, month views; daily goal progress on Day view; percent progress for other members)
- [x] Activity feed (Group stream + **My log** personal history with month calendar)
- [x] Emoji reactions (💪 🔥 😂 👏 😤)
- [x] **Mates** — consent-based connections (shared-group requests or personal mate link), aggregate-stats profile cards, mate leaderboard, block/remove
- [x] Mate nudges (push them / cheer / stir up) with push notifications, one per mate per day
- [x] 1v1 mate battles (1/3/7-day rep battles with live scores)
- [x] Group challenges — one-day, weekend, 7/14/30-day, custom dates; leaderboard, group target, and team-vs-team types; late joiners score from their join day
- [x] XP (1 rep = 1 XP), achievements with server-side unlocks, active streaks with weekly streak freezes
- [x] Admin entry review queue, oversize entry policy, and feed visibility modes
- [x] Group invite tools
- [x] Branded social share previews for invite links (Cloudflare Pages Functions + default OG image)
- [x] Member list on Group tab; join requests and invites in Settings (admin)

- [x] Settings tab in bottom nav (personal + group admin)
- [x] Science-based training plan: weekly microcycle + 4-week mesocycle with per-day targets
- [x] Training plan wizard with saved plan (Log progress + push reminders; rest days skipped)
- [x] Trusted volume calibration: max clean caps set size; recent average drives set count via trust bands
- [x] Max clean check-in (Try max set) on challenge days; capped plan max update confirm in Settings
- [x] Easy / Good / Hard effort feedback after sets; post-challenge soreness check-in
- [x] Week 1 plan tuning adjusts targets from logged pushups + RIR; wizard adapts when log history is stale
- [x] Training wizard calibrates starting volume from recent PushUS log history (structured build, not challenge grind)
- [x] Customisable push reminder frequency (30 min to once daily) and active hours
- [x] Injury pause for reminders
- [x] Light and dark themes (follows system, manual override in Settings)

### Platform

- [x] Supabase backend (Auth, Postgres, RLS, Edge Functions)
- [x] Row Level Security on group data
- [x] Cloudflare Pages–friendly static SPA build
- [x] Per-route browser titles and Open Graph meta for public pages
- [x] Installable Android and iOS PWA setup with app icons, install prompt, and open-from-home-screen nudge when the browser tab is opened by mistake
- [x] AGPL-3.0-only licence
- [x] Self-hostable Community mode
- [x] Optional web push reminders (behind goal, user timezone, configurable frequency; installable app path for more reliable mobile delivery)

---

## Roadmap

These are **directional ideas** — not all implemented yet. See [docs/product-roadmap.md](docs/product-roadmap.md) for detail.

- Group-visible injury/sub-out status with plan pause and ramp-back
- Streak and improvement challenge types; official weekly/monthly auto-competitions
- More leaderboard types (biggest set, goal completion, most improved)
- Admin banter badges and banter notifications (opt-in)
- Hosted **PushUS Cloud** (group billing)
- Better admin and moderation tools

Locked product rules live in [docs/product-decisions.md](docs/product-decisions.md).

---

## Not planned right now

- Public user discovery
- Public global social feed or leaderboard
- Direct messages
- Comments on activity
- Phone contact import
- Profile photos by default
- Proof videos or photos for reps

---

## Self-hosting

PushUS Community runs on **your** Supabase project plus a static frontend host.

1. Clone this repository
2. Create a Supabase project (or run Supabase locally)
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Apply migrations: `supabase db reset` (local) or `npx supabase login` then `npx supabase db push` (hosted). Hosted projects need migrations through `0034_group_streaks` (includes mates, gamification, custom reminder intervals, admin entry review, and Board streaks).
5. Build: `npm run build` and deploy the `dist/` folder

Keep `VITE_BILLING_ENABLED=false` for Community. Never put service role or Stripe secrets in the frontend.

More detail: [docs/self-hosting.md](docs/self-hosting.md) (expanded guide in progress).

---

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run build        # production build
npm run version:check   # semver + README/CHANGELOG alignment (also runs on pre-commit)
```

**Integration tests** (RLS and billing gates) need a running Supabase instance and env vars:

```bash
supabase start
supabase db reset
npm run test:rls
npm run test:billing   # optional; Cloud billing slice
npm run test:e2e       # Playwright smoke tests
```

---

## Licence

PushUS is licensed under **[AGPL-3.0-only](LICENSE)**.

- Free to use, modify, and self-host
- If you run a modified version publicly, AGPL requires making corresponding source available to users
- An official **PushUS Cloud** hosted service may exist later — same open-source codebase, paid for convenience and operations, not for closed source

See [docs/license-summary.md](docs/license-summary.md) (not legal advice).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributions are AGPL-3.0-only. No CLA.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [AGENTS.md](AGENTS.md) | Working guide for AI/dev agents — architecture, commands, performance & styling rules, versioning workflow, careful areas |
| [CHANGELOG.md](CHANGELOG.md) | Meaningful release-level changes |
| [docs/dev-log.md](docs/dev-log.md) | Day-to-day progress (rolled up weekly/monthly) |
| [docs/product-roadmap.md](docs/product-roadmap.md) | Product direction |
| [docs/product-decisions.md](docs/product-decisions.md) | Locked product decisions |
| [docs/self-hosting.md](docs/self-hosting.md) | Self-hosting guide |
| [docs/audio-spec.md](docs/audio-spec.md) | UI sound cue spec for audio production |
| [docs/privacy.md](docs/privacy.md) | Privacy summary |
| [docs/security.md](docs/security.md) | Security and RLS |
| [docs/billing.md](docs/billing.md) | Billing architecture (Cloud) |

---

## Project updates

Day-to-day notes do not live in this README.

- **Release-worthy changes:** [CHANGELOG.md](CHANGELOG.md)
- **Build progress and summaries:** [docs/dev-log.md](docs/dev-log.md)
- **How we maintain docs:** [docs/docs-maintenance.md](docs/docs-maintenance.md)
- **Version checks:** `npm run version:check` before release; `npm run version:bump -- patch` to start a new version
