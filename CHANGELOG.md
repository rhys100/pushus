# Changelog

All notable user-facing and operational changes to PushUS are documented here.

This file records **meaningful** changes — not every small fix or Cursor task. Day-to-day notes go in [docs/dev-log.md](docs/dev-log.md).

Format based on [Keep a Changelog](https://keepachangelog.com/).

---

## Unreleased

### Added

- Customisable push reminder frequency: every hour, every 2 hours, or once per day
- Default reminder window for new users: 7am–7pm, hourly
- Settings tab in bottom nav with personal and group admin sections
- Training plan wizard saves daily target and syncs to Log screen and push reminders

### Changed

- Bottom nav: **Log** (hero tab), shorter labels for Board/Feed, **Settings** bottom-right
- Group tab focuses on members; admin tools (join requests, invites, billing) moved to Settings
- Training wizard recommends a personalised daily target from max clean set (conservative formula)
- Existing users keep once-daily reminders until they change frequency in Settings

### Fixed

- Circular logger haptics now fire synchronously during drag (browser user-gesture requirement); slightly longer tick for easier feel on Android

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
