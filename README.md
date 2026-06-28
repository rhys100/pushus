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
| **v1.0.1** | Per-rep haptic feedback on circular logger (latest) |
| **v1.0.0** | First public release (Community beta) |
| **Private beta** | Invite and allowlist-controlled access on the official deployment |
| **Community edition** | Free, self-hosted; billing disabled by default |
| **Billing disabled** | No Stripe required for Community |
| **PushUS Cloud** | Official hosted paid option — planned; code exists but not beta-enabled |

---

## Implemented

### Core

- [x] Magic link auth
- [x] Optional Google auth (when configured in Supabase)
- [x] Profile onboarding (display name, emoji, timezone)
- [x] Private beta allowlist
- [x] Private groups
- [x] Invite links and invite codes
- [x] Admin approval / join workflows
- [x] Group roles (owner, admin, member)

### Logging

- [x] Direct-drag circular logger (no plus button)
- [x] One lap = 10 push-ups on the ring
- [x] **Bank Push-ups** main CTA
- [x] Undo after banking
- [x] Edit and delete your entries
- [x] Daily total and today's entries on the Log screen
- [x] Entry audit log foundation
- [x] Per-rep tick while dragging the ring (stepped-slider haptics via ios-vibrator-pro-max on supporting browsers)
- [x] Handle snap animation on each rep for tactile feedback

### Social and group

- [x] Weekly leaderboard
- [x] Activity feed
- [x] Emoji reactions
- [x] Group invite tools
- [x] Member list on Group tab; join requests and invites in Settings (admin)

### Settings and training

- [x] Settings tab in bottom nav (personal + group admin)
- [x] Training plan wizard with saved daily target (Log progress + push reminders)
- [x] Customisable push reminder frequency and active hours
- [x] Injury pause for reminders

### Platform

- [x] Supabase backend (Auth, Postgres, RLS, Edge Functions)
- [x] Row Level Security on group data
- [x] Cloudflare Pages–friendly static SPA build
- [x] AGPL-3.0-only licence
- [x] Self-hostable Community mode
- [x] Optional web push reminders (behind goal, user timezone, configurable frequency)

---

## Roadmap

These are **directional ideas** — not all implemented yet. See [docs/product-roadmap.md](docs/product-roadmap.md) for detail.

- Friend and mate connections (consent-based, not a public network)
- 1v1 challenges and friend nudges
- Richer challenge types (teams, weekends, custom dates)
- Streaks, XP, and achievements
- Banter notifications (opt-in)
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
4. Apply migrations: `supabase db reset` (local) or `supabase db push` (hosted)
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
| [CHANGELOG.md](CHANGELOG.md) | Meaningful release-level changes |
| [docs/dev-log.md](docs/dev-log.md) | Day-to-day progress (rolled up weekly/monthly) |
| [docs/product-roadmap.md](docs/product-roadmap.md) | Product direction |
| [docs/product-decisions.md](docs/product-decisions.md) | Locked product decisions |
| [docs/self-hosting.md](docs/self-hosting.md) | Self-hosting guide |
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
