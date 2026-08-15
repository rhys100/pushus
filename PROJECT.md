---
type: Project
title: PushUS (push-ups-app)
description: Private mates push-up challenge app (PushUS).
tags: [pushus, mobile, supabase]
status: active
updated: 2026-08-15
related: []
---

# Identity

PushUS — private group challenge app; Community edition self-hostable.

# Problem

Mates need a private, fast way to log push-ups and challenge each other without creepy public tracking.

# User

PushUS group members (mates/clubs/teams).

# Out of scope

Public social network; mandatory proof videos.

# Mandatory tech

Existing PushUS stack (app + Supabase as configured); respect AGPL.

# Forbidden tech

Creepy public leaderboards; committing `.env` secrets.

# Version 1 done when

Private groups can log, bank, and see group progress reliably on mobile.

# Goal

Fast daily logging, private groups, honest mate competition without creepy tracking.

# Constraints

- Privacy-first; no public creepy leaderboards.
- Do not commit .env secrets.
- Respect AGPL and existing product rules in docs/.

# Log

## 2026-08-15

* **What**: Full test pass (tsc/481 unit/e2e/lint/build all green — the two failures found were stale tests, not app bugs). Service worker now caches the app shell and bundles, so PushUS opens offline and repeat launches serve ~460 kB from disk. Cold start lost a round trip (memberships now embed the group). Fixed a reaction-cache key bug that served the wrong entries' reactions on an active group. Raised sub-44 px tap targets on sign-in, guest and the feed chips.
* **Why**: Asked for a full test, faster reads/writes, an installable Android app, and UI fixes.
* **Risk**: The service worker is the highest-risk change — it is new caching on a PWA that has been burned by cache poisoning before. Mitigated by network-first navigations, content-type guards, and `tests/unit/serviceWorkerCaching.test.ts`. **Rollback**: revert `public/sw.js`; the no-op fetch handler is a safe fallback and users pick it up on next launch.
* **Open**: `android/` TWA wrapper and its workflow are committed but **never executed** — the APK does not exist until the workflow runs. Create the release keystore before publishing any download link, or users cannot upgrade in place (docs/android-apk.md).

## 2026-07-20

* **Update**: Added project identity sections + engineering standards (DoD, architecture, code standards) per NEW_PROJECT_GUIDELINES.

## 2026-07-20

* **Initialization**: OKF project page retrofit (status set to active; confirm/change status is human-owned thereafter).
