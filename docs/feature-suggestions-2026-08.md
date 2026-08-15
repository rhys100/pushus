---
type: Proposal
title: Ten feature suggestions — August 2026
description: Ranked product suggestions for PushUS with rationale, effort and landing zones.
tags: [push-ups-app, roadmap, product]
updated: 2026-08-15
---

# Ten feature suggestions — August 2026

Written after a full pass over the codebase, so each one names where it would
land and what already exists to build on. Ordered by **value per unit of
effort**, not by ambition. Effort is rough calendar days for one person.

---

## 1. Offline banking queue — "log now, sync later"

**Effort: M (3–5 d) · Impact: high**

The service worker now caches the app shell, so PushUS *opens* offline — but
banking still fails, because `bank_pushups` is a live RPC. That is a bad gap:
gyms have terrible signal, and the one moment the app must not fail is the
moment you finish a set.

Queue banks in IndexedDB when the network is down, show them in the day total as
pending, and flush on reconnect via the Background Sync API (falling back to a
flush-on-foreground for iOS, which has no Background Sync).

- **Where:** new `src/lib/offlineQueue.ts`; `useBankPushups` in
  `src/hooks/useTodayData.ts` already does optimistic cache updates, so the UI
  half is mostly built — the optimistic entry just needs to survive a reload.
- **Watch out:** the server enforces the backdate policy, so a set queued
  before midnight and flushed after it must carry its original `logged_for`.

## 2. Rest timer between sets

**Effort: S (1–2 d) · Impact: high**

The training engine already prescribes `todayPrescription.sets`, and the app
knows how many banks you have logged today — but nothing tells you when to
start the next one, so people either rush or drift off. After banking set *n*
of *m*, show a countdown with the next set's target and a gentle chime.

- **Where:** `TodayPage` after a successful bank; reuse the existing bottom-sheet
  pattern and `src/lib/haptics.ts`.
- **Why it wins:** it turns a logger into a coach for a day's work, and it is
  the smallest change on this list with a visible behaviour effect.

## 3. Home-screen widget and app shortcuts

**Effort: S–M (2–4 d) · Impact: high**

Now that there is an Android wrapper (`android/`), a home-screen widget showing
today's total against target — with a tap-to-open-logger action — puts PushUS on
the first screen instead of behind an app drawer. Cheaper first step: add
`shortcuts` to `public/manifest.json` (Log 10, Open board) which both Android
and desktop PWAs surface on long-press, costing about an hour.

- **Where:** `public/manifest.json` for shortcuts; a small `AppWidgetProvider`
  in `android/` for the widget (the only native code the wrapper would gain).

## 4. Weekly group digest push

**Effort: S (1–2 d) · Impact: medium-high**

`supabase/functions/send-push-reminders` already runs on a schedule with a
working push pipeline and per-user opt-outs. A Sunday evening recap — who topped
the board, biggest set, most improved, next week's target — costs one more
function and gives lapsed members a reason to reopen.

- **Where:** new `supabase/functions/send-weekly-digest` alongside the existing
  cron in `.github/workflows/push-reminders-cron.yml`.
- **Watch out:** honour `notification_preferences`; this must be its own toggle,
  not folded into daily reminders.

## 5. Earned streak freeze

**Effort: S–M (2–3 d) · Impact: medium-high**

`docs/product-decisions.md` already treats streaks as protectable (availability
status pauses them). Make that a *currency*: earn a freeze every N clean weeks,
spend it to cover one missed day. Streaks that can never be saved get abandoned
the moment they break — which is exactly when a user is most likely to churn.

- **Where:** `useStreaks` + a new migration for a freeze ledger. Streak semantics
  are a locked area — read `docs/product-decisions.md` before touching them.

## 6. Personal-record share card

**Effort: S (1–2 d) · Impact: medium-high**

`InviteShareCard` and the OG image generator (`scripts/generate-og-assets.ts`,
`@resvg/resvg-wasm`) already render branded images client-side. Reuse that to
produce a "new PR: 42 in one set" card on unlock. This is the app's cheapest
organic growth loop — people post PRs unprompted.

- **Where:** hook into the achievement unlock path that
  `announceFreshAchievements` in `useTodayData.ts` already detects.

## 7. Cross-group challenges (leagues)

**Effort: L (1–2 w) · Impact: medium-high**

Challenges are currently in-group only. Office-vs-office, gym-vs-gym is the
natural expansion and the strongest reason for one group to recruit another.

- **Where:** `useChallenges` / `src/types/gamification.ts`, plus RLS work so a
  member can read an opponent group's *aggregate* without reading its members.
- **Watch out:** this is the riskiest item here from a privacy standpoint. Expose
  totals only, never rows — `npm run test:rls` must gate it.

## 8. "Why this target?" explainer

**Effort: S (1–2 d) · Impact: medium**

The training engine sets a daily target from max clean set, recent volume, RIR
feedback and soreness check-ins — and shows the user a bare number. A one-tap
breakdown ("you rated Tuesday hard, so today is a moderate day") makes the plan
feel earned rather than arbitrary, and makes people trust it enough to follow it.

- **Where:** `DayProgressCard` → a sheet reading the data `useTrainingPlan`
  already has. No backend change at all.

## 9. Health Connect / Apple Health export

**Effort: M (4–6 d) · Impact: medium**

Write banked sets as workouts so PushUS contributes to the ring/activity data
people already care about. Android can go through Health Connect from the TWA
wrapper; iOS has no web path, so it would be a share-sheet export until there is
a native shell.

- **Where:** `android/` (Health Connect permission + a small bridge) and a
  generic CSV/`.fit` export in Settings for everyone else.
- **Honest caveat:** the iOS half is not achievable from a PWA, so this ships
  lopsided. Ship the CSV export first and measure whether anyone asks.

## 10. Cadence metronome in nose-tap mode

**Effort: S (1–2 d) · Impact: medium**

Nose-tap mode already counts reps hands-free with audio and haptics. An optional
metronome (2 s down, 1 s up) turns it into a form tool — slow, controlled reps
are the difference between 20 real push-ups and 20 bounces.

- **Where:** `src/components/logger/NoseTapMode.tsx`, which already owns the
  Web Audio setup. Keep it off by default and behind a Settings toggle.

---

## Deliberately not suggested

- **A native rewrite.** The TWA gets the app on Android with one codebase; a
  rewrite would double the surface area for no user-visible gain.
- **A chart library.** `AGENTS.md` rules it out and the hand-rolled SVG charts
  are smaller and faster than anything off the shelf.
- **Social feed expansion (comments, DMs).** It invites moderation work that a
  privacy-first, self-hostable app has no way to staff.
