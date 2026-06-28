# Changelog

All notable user-facing and operational changes to PushUS are documented here.

This file records **meaningful** changes — not every small fix or Cursor task. Day-to-day notes go in [docs/dev-log.md](docs/dev-log.md).

Format based on [Keep a Changelog](https://keepachangelog.com/).

---

## Unreleased

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
