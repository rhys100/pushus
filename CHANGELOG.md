# Changelog

All notable user-facing and operational changes to PushUS are documented here.

This file records **meaningful** changes — not every small fix or Cursor task. Day-to-day notes go in [docs/dev-log.md](docs/dev-log.md).

Format based on [Keep a Changelog](https://keepachangelog.com/).

---

## Unreleased

### Added

- **Trusted volume calibration (slice 13):** max clean caps set size; recent average shapes set count and daily targets via trust bands (none / partial / trusted)
- **Training plan engine v2:** day-type set sizing (easy 35% / moderate 50% / challenge 60% of max clean); default week Mon–Tue easy, Wed moderate, Thu rest, Fri easy, Sat challenge, Sun rest
- Max clean check-in via explicit **Try max set** mode on challenge days; capped plan max update confirm in Settings
- Easy / Good / Hard / Skip effort sheet after final set or challenge day (maps to RIR internally)
- Post-challenge **soreness check-in** (feeling good / a bit sore / pain — stop) via `user_daily_status_checkins`
- Leaderboard day view: **percent progress for other members**; exact target for self; no target when wizard skipped
- Migration `0026_training_plan_v2.sql`: observed max, pending max update, progression log, max check-in flag on entries
- Week 1 plan tuning: daily baseline adjusts from logged pushups + RIR during the first 7 days after saving a plan
- Training wizard history confidence: trusted / partial / stale paths — max-clean-first when PushUS logs are old or missing

### Changed

- Volume calibration replaces soft baseline hint with two-part model: `trustedVolume.ts` + updated `buildWeeklySchedule`
- Edge `planResolve.ts` mirrors trusted volume when `recent_daily_average` is stored
- Training plan uses **profile timezone** (group timezone for leaderboard only)
- Volume calibration is **hints only** (+10% baseline nudge from daily average); history cannot override max clean; no auto week-2 skip
- Block progression adjusts **baseline only** — no automatic max-clean bumps from effort or observed max
- Training wizard: max clean min 1 step 1, soreness question, skip path, practice-day labels for max clean 1–2
- Training plan preview and settings show honest set targets when mesocycle scaling reduces volume (e.g. `14 total · ~7/set` instead of misleading `2×9`)
- Training wizard: stale-log banner, optional off-app daily average, max-clean mismatch warning; fixed bottom Save/Back dock on mobile

### Fixed

- **Training wizard trust mode:** live manual average in preview (no stale saved value); explicit confirm checkbox for off-app/training average (including when partial PushUS logs exist); tiered mismatch (70/max 20 trusted when confirmed, extreme values stay partial); preview pills and copy by trust mode; Hardest day / Suggested sets labels; 6-day training warnings; removed redundant Back to settings card
- CI lint: unused params and prefer-const in plan engine / progression sync
- **Trusted volume path:** training wizard waits for PushUS log stats before preview; 14+ logged days (or 7+ recent) resolve trusted instead of partial fallback; stale `@vt:partial` rows promote to trusted on rebuild when logs qualify; separate off-app confirmation checkbox; preview copy explains trust mode and capped anchors
- Off-app confirm (`mc:1`) restored when re-editing the wizard; leaderboard daily targets use live log stats for trusted promotion; progression sync waits for history stats before first run
- Plan calibration baseline no longer stuck at 1.0 when structured peak hits the volume cap edge
- SEO shell: Open Graph/Twitter meta tags, `robots.txt`, and `sitemap.xml`
- Branded default social share image (`/og/default.png`)
- Dynamic invite link previews for social crawlers on Cloudflare Pages (group name + share image at `/og/join/:code.png`)
- Reps-in-reserve (RIR) effort feedback after banking on training days — quick 0–5+ chips or Skip; stored per entry
- Training plan auto-progression uses RIR + goal hit rate to adjust max clean set and weekly volume at mesocycle boundaries
- Post-challenge plan calibration: wizard reads 30-day log history, pre-fills max clean set and recent daily average, scales starting baseline for experienced users
- Log page daily set planner: bank-about target, set N of M, and sets remaining (updates after each bank)
- Board Day view: daily goal progress bar per member (reps vs personal training target)

### Changed

- Training wizard: clearer 30-day daily average question, step titles, mobile-friendly preview, log pre-fill on re-run, save gated on soreness acknowledgement
- Toasts moved below the header so they no longer cover settings content above the bottom nav
- **Log page layout:** ring and inline Bank CTA at top; compact today's plan below; removed top private-beta banner strip (~32px reclaimed)
- Circular logger: drag from anywhere on the ring with snap-to-rep on touch; aligned pointer/ring angle math; handle stays on track (no scale flash)
- Stronger tiered drag haptics (18ms notch; stronger pulses at reps 5 and 10)
- Board Day view: single-line rows with inline progress bar and `current/target` fraction
- Board Day progress bar: lighter inset track so partial progress and empty goals read clearly
- Group invite message: richer two-paragraph copy describing PushUS (leaderboards, training plan) without naming the group

### Fixed

- Activity feed: you can no longer react to your own entries (UI hidden + insert/update RLS enforced)
- Push reminder tap opens the log page (`/today`) instead of leaving you on the previous tab
- Push reminder copy matches the log page set planner (e.g. “Bank about 8 — set 1 of 3”) instead of only showing total reps left
- Training plan wizard: Save/Continue actions pinned above bottom nav; push reminder hidden on wizard route
- Bottom dock (nav, bank strip, prompts): solid background, fade scrim, and elevation shadow for readable labels over scrolling content
- Calibrated week-2 plan start no longer reset to week 1 by auto progression sync on first app open
- Cloudflare Pages: dynamic invite OG PNG routes (`/og/join/:code.png`) no longer blocked by `_routes.json`
- Training plan progression sync runs once per user/group/day across pages, not once per hook mount
- Training wizard rejects non-numeric recent daily average input instead of saving NaN
- Training wizard log prefill waits for saved plan + history before applying (fixes re-run race)
- Circular logger accepts taps across the full ring hit target, not just the visual stroke width
- Training plan save confirmation shows inline at top of Settings instead of a bottom toast over page content
- Toasts on headerless Log page use a smaller top inset so they do not cover the circular logger
- Logger handle tick animation resets after banking so later drags only tick on rep boundaries
- Training plan save shows the real Supabase error instead of a generic toast (helps diagnose missing migration)
- Circular logger snaps handle and haptic tick to each rep (1–10) while dragging, not only at a full lap
- Drag count stays in sync when moving the handle backward to a lower rep mid-drag
- Backward drag during an active session no longer leaves centre count, bank state, and `getCount()` ahead of the handle until drag ends
- Twelve-o'clock ring tap with partial count snaps to rep 1 instead of clearing the logger

### Database / deploy

- **Required on hosted Supabase:** apply migrations `0021_training_plan_v2`, `0022_entry_reps_in_reserve`, `0023_plan_calibration`, and `0024_mesocycle_block_start_week` before saving a training plan (`npx supabase login` then `npx supabase db push`). Without them, saves fail on enum/column mismatch or missing RPC.

_(Nothing else yet.)_
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

- **1.0.1** (2026-06-28) — Per-rep haptic feedback and handle snap on circular logger drag
- **1.0.0** (2026-06-28) — Community beta: core loop, private beta, push reminders, open-source release
