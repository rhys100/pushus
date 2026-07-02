# Changelog

All notable user-facing and operational changes to PushUS are documented here.

This file records **meaningful** changes — not every small fix or Cursor task. Day-to-day notes go in [docs/dev-log.md](docs/dev-log.md).

Format based on [Keep a Changelog](https://keepachangelog.com/).

---

## Unreleased

### Added

- Installable Android and iOS PWA setup with generated app icons, iPhone home-screen metadata, and a bottom-dock install prompt for more reliable reminders
- **Open installed app prompt:** when a member opens PushUS in the mobile browser but has previously used the home-screen app (or Android reports the web app installed), a bottom dock nudges them to open PushUS from the home screen instead
- Optional profile **name initial** (single letter, e.g. Rhys E) on onboarding and in Settings
- **Personal mate labels** on the Group Members list — tap a mate to rename for yourself; synced to your account; shown as `Your label (their name)`
- **Feed → My log:** personal rep history with month calendar, daily totals, and set list (moved from Log page)
- **Centre tap on ring:** tap inside the dial to add one rep (hands-free / nose-friendly logging)
- **iOS PWA support:** home-screen install meta tags, PNG app icons, manifest `id`/`scope`, and in-app guidance when push reminders need Add to Home Screen on iPhone/iPad

### Changed

- **Log page layout:** daily progress card above the ring; today's entries moved to Feed → My log
- **Bank Push-ups** button appears only after you start interacting with the ring (drag, centre tap, or keyboard)
- Circular logger ring **20% larger** (rep count scaled to match); drag is incremental only (no jump to rep 10 on grab)
- Log page adds top breathing room equal to the progress card height

### Fixed

- **Feed → My log** no longer crashes on first open before the selected date initialises
- **Open installed app prompt** now appears on Today and when install is inferred from push reminders, a dismissed iOS install prompt, or Android `getInstalledRelatedApps` (manifest uses origin-relative `related_applications`)
- **Open in app** button on Android uses a real in-scope link plus `launch_handler` so Chrome can launch the installed PWA; iOS shows home-screen steps because Safari cannot switch apps automatically
- **Android Open in app:** uses `window.open` then an Android intent URL fallback so Chrome can launch the installed WebAPK instead of reloading the browser tab
- **Open-app reminders:** tapping **Open in app** only snoozes the dock for the current visit and clears any prior permanent dismiss; **Don't remind me again** is the only way to stop future browser reminders
- **Android Chrome open-app detection:** if Chrome does not offer install (already installed PWA), the open-app dock now appears even when local install flags were never set; permanent dismiss storage key bumped so old test dismissals reset
- Blank screen on local dev when `.env` is missing — show a setup screen instead of crashing on Supabase init
- Push reminder service worker is preserved during app update refreshes, so browser subscriptions are not silently broken by clearing old builds
- Push notifications now use generated PWA icon and badge assets instead of a missing favicon file
- Circular logger ring handle and progress arc share the same angle; dial anchors rep 5 at bottom and rep 10 at top with even 36° spacing
- Circular logger no longer jumps to 10 reps when grabbing the handle slightly left of top from zero
- Feed → My log: edit/delete on past days now refreshes that day's totals and entry list (not just today)
- `update_my_profile` now checks private-beta app access (same gate as onboarding profile save)
---

## [1.2.0] - 2026-06-29

### Added

- **Trusted volume calibration:** max clean caps set size; recent average shapes set count and daily targets via trust bands (none / partial / trusted)
- **Training plan engine v2:** day-type set sizing (easy 35% / moderate 50% / challenge 60% of max clean); default week Mon–Tue easy, Wed moderate, Thu rest, Fri easy, Sat challenge, Sun rest
- Max clean check-in via explicit **Try max set** mode on challenge days; capped plan max update confirm in Settings
- Easy / Good / Hard / Skip effort sheet after final set or challenge day (maps to RIR internally)
- Post-challenge **soreness check-in** (feeling good / a bit sore / pain — stop) via `user_daily_status_checkins`
- Leaderboard day view: **percent progress for other members**; exact target for self; no target when wizard skipped
- Week 1 plan tuning: daily baseline adjusts from logged pushups + RIR during the first 7 days after saving a plan
- Training wizard history confidence: trusted / partial / stale paths — max-clean-first when PushUS logs are old or missing
- Reps-in-reserve (RIR) effort feedback after banking on training days — quick 0–5+ chips or Skip; stored per entry
- Post-challenge plan calibration: wizard reads 30-day log history, pre-fills max clean set and recent daily average
- Log page daily set planner: bank-about target, set N of M, and sets remaining (updates after each bank)
- Board Day view: daily goal progress bar per member (reps vs personal training target)
- Branded default social share image (`/og/default.png`); dynamic invite link previews for social crawlers on Cloudflare Pages
- SEO shell: Open Graph/Twitter meta tags, `robots.txt`, and `sitemap.xml`

### Changed

- Volume calibration replaces soft baseline hint with two-part model (`trustedVolume.ts` + updated `buildWeeklySchedule`)
- Edge `planResolve.ts` mirrors trusted volume when `recent_daily_average` is stored
- Training plan uses **profile timezone** (group timezone for leaderboard only)
- Volume calibration is **hints only** (+10% baseline nudge from daily average); history cannot override max clean; no auto week-2 skip
- Block progression adjusts **baseline only** — no automatic max-clean bumps from effort or observed max
- Training wizard: max clean min 1 step 1, soreness question, skip path, practice-day labels for max clean 1–2
- Training plan preview and settings show honest set targets when mesocycle scaling reduces volume (e.g. `14 total · ~7/set`)
- Training wizard: stale-log banner, optional off-app daily average, max-clean mismatch warning; fixed bottom Save/Back dock on mobile
- Training wizard: clearer 30-day daily average question, step titles, mobile-friendly preview, log pre-fill on re-run
- Toasts moved below the header so they no longer cover settings content above the bottom nav
- **Log page layout:** ring and inline Bank CTA at top; compact today's plan below; removed top private-beta banner strip
- Circular logger: drag from anywhere on the ring with snap-to-rep on touch; stronger tiered drag haptics (18ms notch; pulses at reps 5 and 10)
- Board Day view: single-line rows with inline progress bar and `current/target` fraction; lighter inset track for partial progress
- Group invite message: richer two-paragraph copy describing PushUS without naming the group

### Fixed

- **Training wizard trust mode:** live manual average in preview; explicit confirm checkbox for off-app/training average; tiered mismatch; preview pills and copy by trust mode; Hardest day / Suggested sets labels; 6-day training warnings
- **Trusted volume path:** wizard waits for PushUS log stats before preview; 14+ logged days resolve trusted; stale `@vt:partial` rows promote on rebuild; separate off-app confirmation checkbox
- Off-app confirm (`mc:1`) restored when re-editing the wizard; leaderboard daily targets use live log stats; progression sync waits for history stats
- Plan calibration baseline no longer stuck at 1.0 when structured peak hits the volume cap edge
- Activity feed: you can no longer react to your own entries (UI hidden + RLS enforced)
- Push reminder tap opens the log page (`/today`); reminder copy matches set planner (e.g. “Bank about 8 — set 1 of 3”)
- Training plan wizard: Save/Continue pinned above bottom nav; push reminder hidden on wizard route
- Bottom dock: solid background, fade scrim, and elevation shadow for readable labels over scrolling content
- Calibrated week-2 plan start no longer reset to week 1 by auto progression sync on first app open
- Cloudflare Pages: dynamic invite OG PNG routes no longer blocked by `_routes.json`
- Training plan progression sync runs once per user/group/day across pages
- Training wizard rejects non-numeric recent daily average; log prefill waits for saved plan + history
- Circular logger: full ring hit target, snap handle and haptic tick per rep, backward drag sync, twelve-o'clock tap snaps to rep 1
- Training plan save shows the real Supabase error instead of a generic toast
- CI lint: unused params and prefer-const in plan engine / progression sync

### Database / deploy

- **Required on hosted Supabase:** apply migrations through `0027_volume_stats_last_log` (`npx supabase login` then `npx supabase db push`). Key migrations: `0022_entry_reps_in_reserve`, `0023_plan_calibration`, `0024_mesocycle_block_start_week`, `0025_no_self_reactions`, `0026_training_plan_v2` (observed max, effort fields, progression log), `0027_volume_stats_last_log` (wizard last-log metadata). Duplicate `0025` numbering fixed — volume stats renumbered to `0027`.

---

## [1.1.0] - 2026-06-29

### Added

- Science-based training plan: weekly microcycle with rest, easy, moderate, and challenge days
- 4-week mesocycle (ramp in → build → peak → deload) with automatic volume progression
- Per-day targets on Log screen and Settings (rest days show recovery, not a flat daily number)
- Training wizard week preview table and mesocycle explainer on save
- Board tab day/week/month selector (defaults to today); all group members shown even at zero reps
- Customisable push reminder frequency: every hour, every 2 hours, or once per day
- Default reminder window for new users: 7am–7pm, hourly
- Settings tab in bottom nav with personal and group admin sections
- Training plan wizard saves plan and syncs to Log screen and push reminders

### Changed

- Training plan engine replaces flat daily target (= max clean set) with submaximal set prescriptions
- Push reminders resolve today's target from the training plan; skipped on rest days
- Weekly board totals now cover full Mon–Sun calendar week (was Mon–today)
- **Log page overhaul:** progress and ring at top, bank bar above nav, today's entries scroll below
- Circular logger: larger grab handle, handle-only drag start, smoother drag performance, centred rep count, even rep tick marks on ring
- Bottom nav flattened — Log stays centred with accent pill but no longer floats over page content
- Group tab focuses on members; admin tools (join requests, invites, billing) moved to Settings
- Existing users keep once-daily reminders until they change frequency in Settings

### Database

- Migration `0021_training_plan_v2`: `weekly_schedule`, mesocycle fields, enum alignment for wizard values

### Fixed

- Circular logger no longer blocks page scroll when touching outside the ring handle
- Touch drag no longer double-counts reps when pointer and touch move events both fire
- Interrupted pointer drags release scroll lock via `pointercancel`
- Training plan “week N of 4” label matches the schedule multipliers in use
- Push reminders use group timezone and group-scoped banked totals for plan users
- Scrolling today's entries no longer accidentally taps the Log tab (removed overlapping hero FAB)
- Circular logger rep feedback via [ios-vibrator-pro-max](https://vibrator.dev/) — stepped-slider notch tick per rep, major stop at 5, 10, 15…
- Keyboard increment haptics use a synchronously updated count ref so rapid key repeat does not double-tick
- Bottom nav sits flush at screen bottom again (removed unnecessary 3rem safe-area padding)
- Log page uses fixed bank strip above nav with scroll padding
- CI: Node 22 on GitHub Actions; dependency bumps (Vite 6, ESLint 9, typescript-eslint 8.62, Supabase, react-router, Playwright, Vitest) clear high-severity `npm audit` failures

---

## [1.0.1] - 2026-06-28

### Added

- Per-rep haptic feedback while dragging the circular logger (one tick per push-up; pattern when crossing multiple reps quickly)
- Handle snap animation on each rep during drag for clearer tactile feedback

### Notes

- Haptics use the Web Vibration API where supported (typically Android Chrome). iOS Safari often does not vibrate for web apps; visual handle snap still applies.

---

## [1.0.0] - 2026-06-28

First public release — PushUS Community beta.

### Added

- PushUS Community private beta: private groups, invite links/codes, join workflows, and group roles
- Circular direct-drag logger with **Bank Push-ups** flow, undo, edit/delete entries, and daily totals
- Weekly leaderboard and group activity feed with emoji reactions
- Magic link auth, optional Google OAuth, profile onboarding
- Private beta allowlist and access controls
- Web push reminders (optional; behind daily goal during active hours)
- Supabase backend with Row Level Security and integration test gate
- Self-hostable Community mode (billing disabled by default)
- AGPL-3.0-only open-source release with third-party notices
- Cloudflare Pages–compatible static deployment
- Product documentation: roadmap, decision log, implementation plan, dev log

### Changed

- Ongoing mobile UI polish, performance, and security hardening during beta

### Fixed

- Invite join flow, member list visibility, auth session persistence on mobile
- Notification preferences RLS and push reminder delivery path
- Today screen mobile layout and stale PWA cache refresh behaviour

### Security

- Security hardening pass: cron auth for push reminders, billing column protection, expanded RLS tests, CDN security headers

---

## Release history

- **1.2.0** (2026-06-29) — Trusted volume calibration, training plan engine v2, max check-in, effort/soreness feedback, Board day progress, SEO/social previews
- **1.1.0** (2026-06-29) — Science-based training plan, Board views, Log ring UX, Settings tab
- **1.0.1** (2026-06-28) — Per-rep haptic feedback and handle snap on circular logger drag
- **1.0.0** (2026-06-28) — Community beta: core loop, private beta, push reminders, open-source release
