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

### 2026-07-01 (Android open-app detection fix)

**Fixed**
- Dead zone on Android Chrome when PWA already installed: no install prompt, no open-app dock
- Infer installed when `beforeinstallprompt` never fires after load (Chrome behaviour for installed PWAs)
- Reset permanent-dismiss storage key so earlier test dismissals stop blocking the dock

### 2026-07-01 (aggressive open-app reminders)

**Fixed**
- Open in app no longer behaves like a permanent dismiss; it snoozes only for the current visit and re-shows when you return to PushUS in Chrome
- Tapping Open in app clears a previous "don't remind" choice so repeat open clicks keep the reminder enabled
- Secondary button renamed to **Don't remind me again**

### 2026-07-01 (PWA open-in-app button)

**Fixed**
- Open-app dock had no action that launches the installed app — only dismiss buttons
- Android now has a real **Open in app** link (navigation capturing) plus manifest `launch_handler`
- iOS copy is explicit: Safari cannot auto-open the home screen app; numbered steps added

### 2026-07-01 (PWA open-app prompt fix)

**Fixed**
- Open-app banner excluded `/today` (default route) — now shows there
- Broader install inference: push reminders on, iOS install prompt dismissed, Android `getInstalledRelatedApps` on any supporting browser
- Manifest `related_applications` uses relative manifest URL + `id` for cross-origin installs

### 2026-07-01 (PWA open-from-home-screen prompt)

**Shipped**
- Bottom dock when mobile browser detects PushUS was previously opened from the home-screen app (local flag) or Android `getInstalledRelatedApps` reports the web app installed
- Install prompt now hides once install is known, so members are not asked to install again after opening the browser tab by mistake

**Notes**
- Cannot auto-launch the installed PWA from a browser tab; prompt is guidance only
- iOS has no install-detection API — relies on the stored flag after first standalone open

### 2026-07-01 (blank app load fix)

**Fixed**
- Local dev no longer shows a blank screen when `.env` is missing — setup screen explains required Supabase vars
- Playwright smoke tests always boot Vite in `e2e` mode so `.env.e2e` is loaded

### 2026-07-01 (Android/iOS PWA install + push reliability)

**Shipped**
- Android-installable PWA manifest with generated 192/512 and maskable icons
- iOS home-screen metadata and Apple touch icon
- `src/lib/pwa.ts` detects iOS Safari vs standalone home-screen app; Settings + push prompt show Add to Home Screen guidance
- Bottom-dock **Install PushUS** prompt for eligible Android and iOS users before push reminders
- App update refresh keeps the push service worker registered instead of unregistering subscriptions
- Push notifications use real PWA icon and badge assets
- `npm run pwa:generate` generates icons from `favicon.svg` during build

**Tests**
- Focused PWA/push unit tests passing

**Next**
- Rhys spot-check Add to Home Screen on iPhone, then enable push from installed app

### 2026-06-29 (ring dial alignment)

**Fixed**
- Log ring handle and progress arc use the same dial angle; rep 5 at bottom, rep 10 at top, even 36° steps between reps

### 2026-06-29 (ring arc spacing)

**Fixed**
- Log ring progress arc now ends at rep slot boundaries (36° each) instead of handle centre angles, so reps 1–10 look evenly spaced

### 2026-06-29 (mate names slice)

**Shipped**

- Profile name initial (optional single letter) — onboarding + Settings edit profile
- Per-viewer mate labels on Group Members list (`Michael M (mk)`); tap mate row to set/clear; migration `0028_profile_initial_and_aliases`

**Next**

- Consider showing initials on leaderboard if two Sams still confuse people

### 2026-06-29 (release v1.2.0)

**Shipped**
- Release **v1.2.0**: trusted volume calibration, training plan engine v2, max check-in, effort/soreness feedback, Board day progress, SEO/social previews
- Migration numbering fix: `0025_volume_stats_last_log` renumbered to `0027`; `0026` + `0027` pushed to hosted Supabase

**Tests:** full unit suite before tag

**Next:** monitor prod training plan saves post-migration

**Fixed**
- Training average confirm control: checkbox shows when manual avg entered and logs not trusted (partial PushUS history no longer blocks it); confirmed manual uses manual anchor over sparse logs; Hardest day copy in wizard summary; CI lint clean on training modules
- Training wizard trust UX: live manual avg in preview, confirm checkbox, tiered extreme mismatch, trust pills/copy, hardest-day labels, 6-day warnings, removed Back to settings card
- Bugbot slice 13: trust mode persisted in `calibration_note` metadata; partial no longer upgrades to trusted on rebuild; off-app flag wired on save; soreness restored from row; planResolve patterns + partial anchor cap aligned
- Trusted volume path: `resolveVolumeContext()` centralises trust; wizard gates preview on history load; log-first trusted rules + stale partial promotion on rebuild; separate off-app confirm checkbox; honest preview copy and trust mode badge
- Bugbot trusted-path fixes: restore off-app confirm from `mc:1` on wizard re-edit; leaderboard daily targets fetch log stats for promotion; progression sync waits for history stats load

**Notes**
- Deferred schema: `volume_trust_mode`, `volume_anchor_daily_average`, `volume_anchor_source`, `volume_sample_days` on `user_training_plans` — keep `@vt:…` encoding until migration slice; edge reminders still use stored metadata without stats RPC

### 2026-06-29 (trusted volume calibration — slice 13)

**Shipped**
- Two-part schedule model: max clean upper-bounds set size; trusted recent volume drives set count and daily targets
- Trust modes: none / partial (50% blend + max-clean cap) / trusted (7+ logged days or confirmed off-app training)
- Case D fix: low recent volume reduces set size below max-clean formula; high volume never exceeds it
- Wizard + save path pass `volumeContext`; edge `planResolve` mirror updated
- Unit tests: Case C (max 20, avg 65) and Case D (max 40, avg 10)

**Notes**
- `plan_baseline` soft hint retired for volume; baseline stays 1 when trusted bands apply

### 2026-06-29 (CI build fix)

**Fixed**
- TypeScript build errors blocking Cloudflare deploy (invalid Button `size`/`asChild`, `planFromRow` typing, unused params)

### 2026-06-29 (training plan engine v2)

**Shipped**
- Engine v2: null plan contract, day-type set sizing, default 5-day pattern, soft calibration (+10% hint cap), baseline-only progression
- Wizard v2: max clean 1–60 step 1, soreness question, skip for now, history max as hint only
- Today: Try max set mode, Easy/Good/Hard effort sheet, challenge max check-in card, soreness check-in sheet
- Settings: pending max clean confirm (capped +10%), profile timezone for plan
- Leaderboard day view: % for others, exact for self, no target without wizard
- Migration `0026_training_plan_v2.sql`; edge mirror `planResolve.ts` aligned
- Progression sync writes `training_plan_progression_log` on persist

**Tests:** 242 passing (planEngine, volumeCalibration, resolveMemberTodayTarget, effortFeedback, weekOneAdaptation)

**Notes:** Apply migration 0026 on hosted Supabase before max check-in / progression log features work in prod.

### 2026-06-29 (training plan science + adaptive week 1)

**Shipped**
- Honest day-target formatting when mesocycle scaling reduces reps below nominal sets×size
- Calibration fix: manual daily average + clamp fix; high avg → week 2 start
- History-confidence wizard (trusted / partial / stale); off-app avg toggle for stale users
- Week 1 adaptive baseline from logs + RIR (`weekOneAdaptation.ts` + progression sync)
- Wizard dock padding token; migration `0027_volume_stats_last_log.sql` (renumbered from duplicate 0025)

**Tests:** 240 passing (planEngine, volumeCalibration, weekOneAdaptation)

**Notes:** Deploy migration 0025 on hosted Supabase for last-log metadata in wizard.

### 2026-06-29 (activity feed reactions)

**Fixed**
- Block self-reactions on activity feed entries — emoji buttons hidden on your own posts; RLS rejects direct inserts and retargeting via update; existing self-reactions cleaned up in migration 0025

### 2026-06-29 (push reminder UX)

**Fixed**
- Notification tap navigates to `/today` (service worker `navigate` + React fallback)
- Reminder body uses set-planner copy; title shortened to `PushUS`

**Deploy**
- Redeploy `send-push-reminders` edge function + Cloudflare (service worker update)

### 2026-06-29 (ring drag mechanics)

**Shipped**
- Drag from anywhere on the ring track; touch snaps immediately to nearest rep slot
- Fixed handle flash/off-ring during drag (single React angle source, stroke tick animation)
- Haptics bumped to 18ms / half-lap / lap tiers

**Fixed (Bugbot)**
- Top-of-ring tap with partial count snaps to rep 1 instead of zeroing
- Wizard log prefill split from saved-plan hydration so late history still applies

### 2026-06-29 (training wizard copy and UI)

**Changed**

- Step titles (Your capacity / Your week / Preview plan), 30-day daily average question, history card above input
- Re-run prefill when saved plan has no recent daily average; save gated on soreness checkbox
- Mobile stacked schedule on preview step; trimmed settings header card

### 2026-06-29 (log page hero reorder)

**Shipped**
- Log layout: ring + inline bank at top, compact plan card below, entries last
- Removed top private-beta banner strip for ~32px vertical space
- Stronger tiered drag haptics (14ms notch, stronger 5 and 10 lap stops)

**Fixed**
- Logger backward drag keeps centre count, bank enablement, and parent `dragCount` in sync mid-drag (Bugbot)

### 2026-06-29 (post-challenge plan calibration)

**Shipped**

- `volumeCalibration.ts`: 28-day history stats, wizard pre-fill, baseline + mesocycle week derivation
- Migration `0023_plan_calibration`: `recent_daily_average`, `calibration_note`, `user_volume_stats` RPC
- Training wizard: history card, recent daily average field, preview copy explaining structured vs grind volume
- Save applies calibration to initial `plan_baseline` and optional week-2 start

**Tests**

- `npm test -- tests/unit/volumeCalibration.test.ts tests/unit/planEngine.test.ts`

**Deploy**

- Hosted Supabase needs migration `0023_plan_calibration` (`npx supabase db push`)

### 2026-06-29 (Bugbot fixes)

**Fixed**

- Week-2 calibration: `mesocycle_block_start_week` + `getMesocycleWeekInBlock` so progression sync no longer resets to week 1
- `_routes.json`: allow `/og/join/:code.png` Pages Function
- Progression sync deduped module-wide per user/group/day
- Wizard recent daily average rejects NaN input

**Deploy**

- Hosted Supabase needs migration `0024_mesocycle_block_start_week`

### 2026-06-29 (SEO and social previews)

**Shipped**

- Per-route browser tab titles (`useDocumentTitle` + AppLayout wiring)
- Static OG/Twitter meta in `index.html`; build injects `VITE_APP_URL`
- Branded share images: default PNG at build time; dynamic invite PNG via Cloudflare Pages Function
- Crawler HTML for `/join/:code` with group-specific OG tags
- `robots.txt`, `sitemap.xml`, docs at `docs/seo-and-social-previews.md`

**Notes**

- CF Pages needs runtime `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL` (not just `VITE_*`)

### 2026-06-29 (RIR effort feedback)

**Shipped**
- Training-day banks: optional reps-in-reserve sheet (0–5+ or Skip)
- RIR on entries; `(+N left)` in today's list; plan sync adjusts max clean set + baseline

**Deploy**
- Hosted Supabase needs migration `0022_entry_reps_in_reserve` (`npx supabase db push`)

### 2026-06-29 (board progress track contrast)

**Changed**
- Board Day progress bar track bumped to muted grey inset (`text-muted/25`) — easier to read than the first dark groove

### 2026-06-29 (board progress track)

**Changed**
- Board Day progress bar: lighter inset track so partial fill and 0-rep rows show remaining goal clearly

### 2026-06-29 (board single-line rows)

**Changed**
- Board Day rows collapsed to one line: rank, emoji, name, inline bar, fraction

### 2026-06-29 (board progress layout)

**Changed**
- Board Day rows: full-width progress bar + clean `0/25` fraction; removed duplicate rep column

### 2026-06-29 (log daily set planner)

**Shipped**
- Log page shows today's plan: day type, bank-about reps, set N of M, sets remaining (updates after each bank)

### 2026-06-29 (training plan save fix)

**Fixed**
- Save error toast now surfaces Supabase message (enum/column errors visible)
- RLS test for `user_training_plans` upsert with advanced/intense + v2 columns

**Deploy**
- Hosted Supabase must run migration `0021_training_plan_v2` (`npx supabase login` then `npx supabase db push`) before training wizard save works

### 2026-06-29 (board daily progress)

**Shipped**
- Board Day view: progress bar per member toward today's personal training goal

### 2026-06-29 (logger rep snap)

**Fixed**
- Ring drag snaps handle + haptic to each rep slot (1–10), matching full-lap feel
- Backward drag mid-session keeps displayed count and bank total in sync with handle

### 2026-06-29 (release v1.1.0)

**Shipped**
- Released v1.1.0: training plan v2, Board periods, Log ring UX, Settings tab, push reminder frequency

**Next**
- Push tag and deploy; Rhys spot-check logger drag on device

### 2026-06-29 (science-based training plan)

**Shipped**
- Replaced flat daily target engine with weekly microcycle (rest/easy/moderate/challenge) and 4-week mesocycle
- Per-day targets on Log, Settings, and push reminders; rest days show recovery
- Migration `0021_training_plan_v2` for schedule JSON, mesocycle fields, enum fix
- Wizard step 3: 7-day schedule table, mesocycle copy, pre-fill from saved plan

**Tests**
- `npm test` — 160 passed

### 2026-06-29 (log ring UX + leaderboard periods)

**Shipped**
- Circular logger UX: bigger handle (13px), 44px hit target, handle-only drag start, DOM-updated visuals during drag, HTML-centred rep count, butt-cap progress arc, rep tick marks, page scroll restored outside handle
- Board tab: Day / Week / Month selector (default Day); all group members shown even at 0 reps; week view is full Mon–Sun

**Fixed**
- Bugbot: touch drag double-delta, missing pointercancel, mesocycle week label vs schedule mismatch
- Training plan and push reminders use group timezone; reminders scope banked totals to plan group

**Next**
- Rhys spot-check drag feel on real device

### 2026-06-28 (nav polish + doc automation)

- Centred hero **Log** tab in bottom nav; fixed clipped semi-circle and white-dot icon on active state
- Pre-commit hook: `version:check` + doc staging gate for user-visible code changes
- README **Implemented** checklist updated for settings hub, training plan, and reminder frequency

### 2026-06-28 (nav + settings hub + training plan)

- Bottom nav: Log (hero), Board, Feed, Group, Settings (bottom-right)
- Settings hub: Personal (profile, training plan, push reminders) + Group admin (invites, join requests, billing)
- Training wizard persists to `user_training_plans` and updates daily target on Log + notifications
- Group tab simplified to members list

### 2026-06-28 (reminder frequency)

- Added `reminder_interval_hours` to `notification_preferences` (1, 2, or 24)
- Settings: frequency picker (hourly / every 2 hours / once per day)
- Default active hours for new users: 7am–7pm; existing users unchanged until they edit Settings
- Eligibility logic updated in `notificationEligibility.ts` and `send-push-reminders` edge function

### 2026-06-28 (Log page + nav)

#### Fixed

- Flat bottom nav — Log accent pill contained in bar; no overflow FAB stealing scroll touches
- Log page: sticky bank bar above nav, entries list scrolls cleanly below
- Rep feedback via **ios-vibrator-pro-max** — stepped-slider notch (8ms) per rep, major stop `[12,8,12]` at 5, 10, 15…

#### Notes

- Rep feedback uses [ios-vibrator-pro-max](https://vibrator.dev/) — same patterns as the [Haptic Playground stepped slider](https://haptic-sliders.vercel.app/)
- iOS still has no web vibration API; audio tick is the fallback there too
- Redeploy required for layout + `_headers` changes

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
