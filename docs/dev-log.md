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

### 2026-07-08 (Settings page IA redesign)

- **Sectioned the Settings page** into six titled groups (Account / Preferences / Training / Notifications / Group tools / About) via a new `SettingsSection` component — was a flat stack of ten equal-weight cards with no hierarchy.
- **Push reminders de-cluttered:** dropped the dev-facing "Permission: granted / Status: on" readout for one plain line ("On · every hour, 07:00–20:00"); removed a duplicated "only works in the installed app" notice (it showed even when already installed); the From/Until/Frequency/Injury controls now appear only when reminders are on, behind a divider, instead of sitting greyed-out.
- **Training card slimmed:** replaced the giant mono "45 push-ups" hero (a dupe of the Today screen) with a compact summary row (today's target + Week/Max/Peak) above the weekly dots.
- Profile card lost its orphan "PERSONAL" eyebrow (the section header carries the grouping now); About section gains an app-version line. No behaviour changed — pure IA + presentation.

### 2026-07-08 (UX-audit loop — error-state dead ends)

- **"Try again" on every load-error state.** Four error `EmptyState`s (Board leaderboard, group Feed, Challenges list, Feed → My log) and the Group → Members error told the user to "check your connection and try again" but gave no button to do it. Each now wires the query's `refetch` (RepHistoryPanel fans out to the 3 push-up / 2 custom queries behind its combined error; Members error swapped its unreliable "pull to refresh" copy for a `Try again` button showing `isFetching`). Reuses the existing `EmptyState` `actionLabel`/`onAction` support — no new components.
- Backlog from this pass's settings audit (for later iterations): destructive moderation actions (Reject/Decline) styled as neutral `ghost` with no confirm; sub-44px touch targets on Edit/Archive/Approve/Reject; section titles are `<p>` not headings; missing error branch in Custom activities; duplicated reminder notice + "Personal" orphan eyebrow on Settings.

### 2026-07-08 (design-review loop — auth funnel accessibility and dead ends)

- **`ButtonRouterLink`** added to the ui kit and swapped in for all ten `<Link><Button>` nestings across the auth funnel (JoinPage ×5, CreateGroupPage ×2, JoinLandingPage, PrivateBetaPage, AboutPage) — interactive-in-interactive is invalid HTML, double tab stops, and reads wrong in screen readers. New rule: navigation styled as a button uses `ButtonRouterLink`, never nesting.
- **Magic-link success screen** now echoes the destination email (typo catch) and offers **Resend** with a 60s cooldown matched to Supabase's OTP rate limit.
- **PendingPage** polls membership every 15s so an approved member is routed into the app automatically instead of waiting on a manual "Check again" tap.

### 2026-07-08 (motion pass — social surfaces)

- **Mates:** nudge send / mate accept / battle accept / challenge send fire `successHaptic`; 1v1 scores and the you-vs-them stat grid count up; 1d/3d/7d pills get tick + press + gated selection pop; mate detail rises on expand; page staggers; "You won 🏆" badge pops.
- **Challenges:** standings glide via `useFlipList` with winner-trophy pop; list page staggers; intensity pills get the pill treatment; create form rises in; create success kicks back a haptic.
- **Achievements:** streak card pulses `goal-celebrate` when you visit on a milestone day (7/14/21/30/50/75, then every 50) with today banked.
- **Group/MateAdd:** hub cards (Mates/Challenges/Badges) get press-scale + tick; mate-link landing celebrates the handshake (rise + delayed emoji pop + success haptic).

### 2026-07-08 (design polish pass 5 — activity continuity)

- **UX:** Board → My progress and Feed → My log now default to the activity the Log page is currently banking (`pushus-log-activity:{userId}` read-only follow) instead of resetting to Push-ups each visit. Picking chips on those surfaces doesn't write the preference back — the Log page owns it. Unknown/archived stored ids fall back to Push-ups automatically.

### 2026-07-07 (motion & haptics system — design-review loop)

- **Foundation:** `src/styles/motion.css` (rise/pop/fade/sheet/popup/celebrate/cascade vocabulary + global reduced-motion guard that exempts the functional hold-to-open ring), `--ease-spring` + `--duration-slower` tokens, `src/lib/haptics.ts` (tap/select/success tiers beside the logger's rep patterns), hooks: `useCountUp` (rAF count-up, locale-formatted in StatCard), `useFlipList` (WAAPI FLIP, offsetTop-based so scroll can't skew it), `usePresence` (stay mounted through exit animations).
- **Chart draw:** `ProgressChart` rebuilt around a frame-driven "yarn chasing the dot" — leader dot eases along the polyline by arc length, stroke dashoffset trails it with an exponential lag, data dots pop as the yarn passes their cumulative length, final dot pings; series stagger; replays only when the data signature changes; static render under reduced motion.
- **Feedback moments:** daily-goal crossing pulses the Today card (success ring + `successHaptic`) with a hydration guard so query load can't false-fire it (same guard fixed a load-flash bug in `GoalProgressBar`); toasts spring in and now animate out; copy-invite buttons pop "✓ Copied" at the thumb; magic-link send pops the envelope; What's new popup springs with staggered items; effort/soreness sheets slide; calendar months cascade with haptic day-select; login/onboarding stagger in with a living emoji picker.
- **Gotcha worth remembering:** entrance animations must use `fill-mode: backwards`, not `both` — a filling CSS animation permanently overrides later `transform` styles, silently killing `active:scale` press physics; and two animation classes on one element (`cal-pop` + `motion-pop`) cancel — the cascade winner takes the shorthand, so entrances live on wrapper elements where both are needed.
- **Verification:** the preview harness window is occluded (rAF throttled, `visibilityState: hidden`), so animation checks run through headless Playwright against `/dev/preview`, which gained a motion showcase (replay chart draw, goal-hit demo, FLIP shuffle, sheet toggle, calendar, flame). `vite.config.ts` moved `cacheDir` out of the Dropbox tree — Dropbox was locking the dep-optimizer rename (EBUSY) and dev served 504s.

### 2026-07-07 (big feature push — mates, challenges, gamification, light mode, reminder fix)

- **Reminder "one ding a day" root cause found and fixed:** `sw.js` used a fixed notification `tag` without `renotify`, so Android silently replaced the tray notification for every reminder after the first. Added `renotify: true`. Second cause: GitHub Actions cron jitter + strict 60-min elapsed check skipped alternate hours — eligibility now tolerates 10 min of scheduler slack (`REMINDER_INTERVAL_TOLERANCE_MINUTES`, mirrored in the edge function).
- **Reminder frequency in minutes** (30m/1h/2h/3h/4h/daily) via migration `0030` with a sync trigger keeping legacy `reminder_interval_hours` coherent for stale cached PWA clients. pg_cron snippet (15-min tick) added as the preferred scheduler; GH Actions demoted to documented fallback.
- **Light mode** shipped: `[data-theme]` token blocks in `tokens.css` (dark stays default; nested `data-theme="dark"` pins nose-tap mode dark), pre-paint script in `index.html`, `src/lib/theme.ts` manager, Settings → Appearance (Light/Dark/System). New tokens for card/toast/popup/dock shadows and logger hub/track so no component carries theme-specific hexes.
- **Gamification live** via migration `0031`: XP triggers on `pushup_entries` (insert/update/delete aware, review-status aware) + history backfill; achievements catalog seed + trigger-based unlocks (incl. SQL active-streak calc honouring rest days/freezes); streak freeze UX = explicit "Protect yesterday", 1/week.
- **Challenges** built on the existing `competitions` schema: admin create form (formats map to timezone-correct windows in `src/lib/challenges.ts`), join flows with beginner warnings for hard/stupid, live standings, team-vs-team with one-off teams, group-target progress bar, late joiners scored from join day.
- **Mates** via migration `0032`: consent graph (request from shared groups OR rotatable personal mate link; accept/decline/remove/block), all writes through SECURITY DEFINER RPCs, read RPCs return aggregate stats only. Nudges (1/mate/day, `send-nudge` edge function delivers push respecting quiet hours + injury pause) and 1v1 battles (1/3/7-day, live scores) ride the same graph.
- **Quick wins:** locked reaction set 💪🔥😂👏😤; admin entry review queue + oversize policy + feed visibility selects in Group admin settings (migration `0033` adds `list_pending_entries`/`review_entry`; `activity_feed` already respected visibility modes server-side).
- **Deploy checklist:** `supabase db push` (0030–0034), deploy `send-push-reminders` + `send-nudge` edge functions, run the pg_cron snippet with `CRON_SECRET` in Vault, then disable the GH Actions cron.
- **Design-review loop follow-ups (same day):** achievement-unlock toasts on bank; `--color-on-accent` token fixing light-mode primary-button contrast (was ~3:1 white-on-orange); Board streak flames via `group_active_streaks` RPC (migration `0034`); lifetime-club badge progress bars; creator auto-join on challenge create; create-form validation hints; you-vs-mate stat caption; challenge countdowns; feed-off empty state; freeze only offered when it reconnects a streak; in-app received-nudges strip; recent 1v1 results section; admin challenge delete.
- Not built yet from the todo list: group-visible injury/sub-out status (plan pause + ramp-back + weekly check-ins), daily-goal celebrate/overage caps UX, streak/improvement challenge types (locked as later anyway), denser feed layouts, weekly/monthly official auto-competitions.

### 2026-07-07 (design polish pass 2 — restore archived)

- **Added:** archived custom activities can be restored — collapsed "Archived (n)" section at the bottom of Settings → Custom activities with a Restore button; history and progress come back with it. Restore can fail if an active activity re-uses the name (unique per user) — raw error surfaced as the hint.
- **Tweak:** `ActivityIcon` stroke 1.75 → 2 so figure pictograms stay legible at the 14px pill/chip sizes.

### 2026-07-07 (exercise pictogram icons)

- **Changed:** icon picker now leads with 10 exercise figure pictograms (pull-up, squat, sit-up, dip, lunge, plank, calf raise, leg raise, jumping jack, dumbbell curl) — equipment/generic marks moved behind a "More icons" toggle (`PRIMARY_ACTIVITY_ICON_IDS` / `MORE_ACTIVITY_ICON_IDS`). Editing an activity whose icon is in the More set auto-expands it.
- Verified shapes visually by rasterising the catalog with `@resvg/resvg-js` (same tooling as PWA assets) — fixed the dip figure (arms now angle down to the bars).
- `vite.config.ts` dev server honours `PORT` so preview tooling can run beside another dev server in this folder.

### 2026-07-07 (design polish pass 1)

- **UX:** sided activities auto-flip the Left/Right toggle after each bank (left set → right is next); Bank button now names the side ("Bank Calf raises (left)") so mis-side logging is obvious before tapping.
- **Safety:** Settings → Archive is now two-tap (arms to a red "Confirm?" for 4s) — no restore UI exists yet, so single-tap archive was too easy to hit next to Edit.
- **Consistency:** What's new popup + history now use the activity line-icon set (barbell/mountain/target/bolt) instead of emojis, in bordered tiles matching the Settings list.

### 2026-07-07 (activity line icons)

- **Changed:** custom activity emojis replaced with a 12-icon minimal stroke set (`src/lib/activityIcons.ts` data + `ActivityIcon` component). 24×24, stroke 1.75, `currentColor` so accent/muted colours flow in. Several shapes adapted from Lucide (ISC), plus hand-drawn barbell/kettlebell/pull-up figure/jump rope.
- The `custom_activities.emoji` column now stores icon ids ('barbell', 'bolt', …); unknown values (legacy emojis) render as text so old rows keep working. Push-ups uses the brand bolt (`PUSHUPS_ICON`) in the switcher, picker sheet, progress chips, and day card.

### 2026-07-07 (what's new history + beta sign-off)

- **Added:** Settings → What's new (`/settings/whats-new`) — full launch history grouped by date with `version` badges (new optional field on `NewsItem`); popup gained a "See past updates" link.
- **Added:** `WHATS_NEW_SIGNOFF` ("Love Rhys + MK 🧡") on the popup and history page while in beta.

### 2026-07-07 (what's new popup)

- **Added:** "What's new" modal for feature launches. Static catalog in `src/lib/whatsNew.ts` (newest first, stable ids); per-device seen marker `pushus-news-last-seen:{userId}`; join-date filter so new members never see pre-join launches. Mounted in `TabLayout` (member tabs only, so it can't fire mid-onboarding). Pure logic unit-tested in `tests/unit/whatsNew.test.ts`.
- **Process:** when shipping a major feature, add a `NewsItem` at the top of `NEWS_ITEMS` in the same PR.

### 2026-07-07 (custom activities, progress chart, board privacy)

- **Added:** custom activities — personal exercises with optional left/right side tracking. New tables `custom_activities` + `custom_activity_entries` (migration `0029`, owner-only RLS, no RPCs — direct table access). Log page gets a switcher pill + picker sheet, side toggle, custom day-tally card; bank/undo via toast. Ring resets on activity switch so reps can't cross activities. Last selection persisted per device (`pushus-log-activity:{userId}`).
- **Added:** "My progress" on the Board — `ProgressChart` (SVG, no deps) + `progressStats.ts` pure aggregation (daily 14d / weekly 12w Monday buckets, Total/Best set, L/R series). Unit tests in `tests/unit/progressStats.test.ts`.
- **Added:** `profiles.show_rep_totals` + `leaderboard_total` returns it; day board shows raw reps for opted-in members instead of %. Settings → Board privacy toggle.
- **Added:** +10 quick-add button on Log page (`CircularLoggerHandle.addReps`).
- **Fixed:** theme-color/manifest colours aligned to `#0a0a0d` (three sync'd spots: manifest.json, manifest.webmanifest, `functions/_shared/webAppManifest.ts`); `color-scheme: dark` added (tokens.css + meta) for light-mode phones.
- **Note:** migration 0029 must be applied (`supabase db push`) before the new features light up; app degrades gracefully without it.

### 2026-07-06 (PWA dark-mode icons)

- **Fixed:** PWA app icon, maskable icon, and push notification badge rasterised favicon masks as black silhouettes on dark Android. Generator now uses flat `PUSHUS_LOGO_PATH` (same as OG images); maskable icons use full-bleed square backgrounds.
- **Tests:** `tests/unit/pwaAssets.test.ts` guards purple/white raster output.

### 2026-07-03 (reset open-in-app dock dismiss)

- **Fixed:** Settings link to restore open-in-app bottom dock after "Don't remind me again".

### 2026-07-03 (open-app vs install dock)

- **Fixed:** Installed Android users stuck on install dock — open-app eligible when Chrome no longer offers install; Settings **Open in app** for push.

### 2026-07-03 (open in app detection fix)

- **Fixed:** Open in app dock missing after install — dynamic manifest with absolute `related_applications` URL for `getInstalledRelatedApps()`.
- **Fixed:** WebAPK id matching and re-check on route change / `appinstalled`.

### 2026-07-03 (PWA push UI bug fixes)

- **Fixed:** Duplicate red install error on Settings when enabling push without PWA.
- **Fixed:** Disabled Bank Push-ups button contrast at 0 reps.
- **Fixed:** Nose-hold "Don't remind me again" link contrast.
- **Fixed:** Android install dock shows manual Chrome steps when native install prompt unavailable.

### 2026-07-03 (push requires PWA install)

- **Fixed:** Push reminders gated on installed PWA (Android + iOS). Enable attempts re-check install via `getInstalledRelatedApps()` and re-show install prompt.
- **Fixed:** Stale install flag cleared after Android uninstall so install dock works again.
- **Tests:** `tests/unit/pwaInstallStatus.test.ts`, updated open-app prompt tests.

### 2026-07-03 (Android open in app via window.open)

- **Fixed:** `openInstalledPwa()` uses `window.open(inScopeUrl, '_blank', 'noopener,noreferrer')` — no location.assign or intent URLs.
- **Manifest:** added `manifest.json`, `start_url` → `/today?source=pwa`, `related_applications.url` → `/manifest.json`, index.html manifest link updated.
- **UI:** Android dock primary button **Open in app** restored; iOS keeps home-screen steps only.

### 2026-07-03 (open in app honest Android UX)

- **Fixed:** Open in app flash/reload — Chrome cannot hand off from an in-tab session. Android dock now prioritises home-screen steps; Try open in app anyway uses intent without browser fallback.
- **Docs:** `docs/pwa-open-in-app.md`, cursor rule updated.

### 2026-07-03 (open in app Android + dock card design)

- **Fixed:** Open in app on Android — real https `ButtonLink` with `target="_blank"` instead of `web+pushus://` (protocol_handlers unsupported on Chrome Android).
- **Fixed:** Bottom dock prompts — floating card UI, accent top bar, full-width mobile buttons.
- **Docs:** `docs/pwa-open-in-app.md`, cursor rule updated.

### 2026-07-03 (notification banner readability)

- **Fixed:** Toasts and inline banners (billing, training wizard warnings, settings plan saved, max-set callouts) now use shared opaque `noticeStyles` surfaces — no more unreadable transparent green squiggles over page text.
- **Fixed:** Bottom dock prompts (install, open PWA, push reminders) — solid surface panel, readable secondary buttons, scroll reserve on tab pages so leaderboard/settings content is not buried under the dock.
- **Fixed:** Settings training plan week grid — filled day chips, today highlighted in profile timezone.
- **Tests:** `tests/unit/noticeStyles.test.ts`
- **CI:** restored missing `buildTrustModeLabel` import in TrainingWizard
- **Next:** Spot-check invite copy toast on mobile Settings after deploy.

### 2026-07-03 (nose hint below Bank; ring layout jump fix)

- **Nose-hold hint** extracted to `NoseHoldHint` and moved below the Bank CTA on `/today` and `/dev/preview` (was between ring and Bank inside the centred flex column).
- **Ring jump on touch:** the hint used to unmount when `isDragging` or `centerHolding` became true, shrinking the centred flex group and pushing the ring down. It now stays visible until the user taps "Don't remind me again" (reserved `min-h` slot while visible).
- **Touch:** logger outer container also gets permanent `touch-none` (not only the SVG).

### 2026-07-03 (log page polish: 1.5s hold, drag scroll fix, Bank below ring)

- **Nose hold** shortened from 2s to 1.5s (`CENTER_HOLD_MS`); hint copy + README/CHANGELOG updated.
- **Ring drag scroll fix:** the SVG now has permanent `touch-action: none` (`touch-none`). Previously `touch-action` only went to `none` once `isDragging` was true, but that state flips after the touch starts — so the first part of every touch-drag panned the page. Reported as "moves down every time you touch it, not staying in position".
- **Layout:** Bank CTA moved back below the ring (user preference). Order is now training-plan strip → ring → Bank CTA on `/today` and `/dev/preview`. Removed the leftover 3-stat mock card from the dev preview.
- **Summary redesign:** the compact `DayProgressCard` is now a clean three-stat row (Set `N of M` · Bank next `~X` · Today `banked/target`) matching the stat-card look Rhys liked, with rest-day and goal-hit states and a small day-type/safety caption. Dropped the old headline/progress-bar strip and the `formatDayTargetSetsDetail` line.

### 2026-07-03 (open-in-app launches PWA via custom protocol)

**Fixed**
- "Open in app" wasn't opening the installed PWA. Root cause: `openInstalledPwa()` navigated to a plain `intent://…;scheme=https;action=VIEW;…` URL with no `package=`. Chrome is a valid https handler and you're already in Chrome, so it just reloaded the URL in the tab instead of handing off to the WebAPK. The WebAPK package name is generated by Chrome and isn't readable from the web, so `package=` isn't an option.
- New approach: registered a custom protocol handler `web+pushus` in `public/manifest.webmanifest` (`protocol_handlers`, url `/today?source=open-app&h=%s`). The button now navigates to `web+pushus://open`, which Chrome resolves to the installed standalone app. `openInstalledPwa()` simplified to use `buildPwaProtocolLaunchUrl()`; removed the intent-URL builder.
- Copy updated: if nothing happens, reopen the app once from the home screen to update it, then retry.

**Caveat / QA**
- Only works once the installed WebAPK is updated to a manifest with the handler; older installs must reopen/reinstall. Can't be verified from the dev machine — needs an Android device with the PushUS PWA installed. Rhys to confirm on-device.

**Tests**
- `tests/unit/pwaOpenInApp.test.ts` now asserts the protocol scheme/URL; `tests/unit/pwaManifest.test.ts` asserts the `web+pushus` handler is registered with a `%s` template. Lint/tsc/build green.

### 2026-07-03 (logger laps, comet snake, nose-hold gesture + hint)

**Changed**
- Lap-based ring fill: ring fills a full lap every 10 reps; each new lap uses the next colour in a cool → hot palette across 10 laps (up to 100 reps). Palette + lap-index maths in `src/lib/loggerLaps.ts` (unit-tested in `tests/unit/loggerLaps.test.ts`). Completed laps render as a solid base ring under the current lap.
- Current lap draws as a teardrop comet "snake" — trail segments taper in both stroke width (fat head → thin wisp) and opacity (fades to ~0.04), with a blurred head glow and a white highlight tip. Reworked in `src/components/logger/CircularLogger.tsx` after Rhys feedback that the earlier flat-fade trail read as a solid ring.
- Nose reps: removed the separate button; now a 2-second hold on the ring centre opens nose-tap mode (`onLongPressCenter`). `TodayPage` layout puts the Bank CTA on top, a compact plan strip beneath, then the ring.

**Added**
- Dismissible teaching hint under the ring: "Nose reps: hold the centre of the ring for 2 seconds" with a "Don't remind me again" action. Persisted via `useNoseHoldHint` / `pushus.nose-hold-hint-v1` (mirrors the existing `useLoggerDragHint`).

**Fixed**
- Compact daily plan strip lost the reps-per-set line when the plan info moved under the Bank CTA. `DayProgressCard` (compact) now renders `formatDayTargetSetsDetail()` (e.g. "3 sets of 15") and no longer duplicates "set X of Y" (it was in the headline and appended again). Added a sample plan strip to `/dev/preview` so this is QA-able without a backend.
- Bugbot high finding: the 2s centre-hold timer could survive a press that started on the centre and slid into a ring drag, firing `onLongPressCenter()` mid-logging. `beginDragAt` now clears the pending hold timer and holding state when any drag starts.

**Tests / checks**
- `npm run lint` (0 errors), `npx tsc -b`, and `npm run build` all pass. Visual QA on `/dev/preview`: comet at 6 (lap 1) and 14 (lap 2) reps, hint render + dismiss.

**Next**
- Commit + push Slice B as its own PR (Rhys chose a new PR).

### 2026-07-03 (open-in-app dock fix + docs)

**Fixed**
- Open-app dock buttons hidden behind the bottom nav on `/today`: `/today` was missing from the nav-offset path list, so the dock sat at `bottom-0` behind the nav bar. Moved the path list into `pwaOpenAppPromptSitsAboveBottomNav()` (`src/lib/pwaOpenAppPrompt.ts`) and offset all member tab routes above the nav.

**Docs**
- Added [docs/pwa-open-in-app.md](./pwa-open-in-app.md) and `.cursor/rules/pwa-open-in-app.mdc` documenting the feature + the dock-above-nav invariant so it is not silently re-broken.

**Tests**
- Added guard tests in `tests/unit/pwaOpenAppPrompt.test.ts` for dock placement across member tab routes and non-nav routes.

**Notes**
- Also synced README/CHANGELOG for the merged PR #10 (chunky glow UI, nose-tap mode, bank ritual) which had shipped without doc updates.

### 2026-07-02 (ring handle grab zone)

**Fixed**
- Orange handle hard to grab on mobile: thumb-sized invisible hit target, `canStartRingDrag`, hit-test ring size aligned to 336px

### 2026-07-02 (log page spacing + My log fix)

**Fixed**
- Feed → My log crash when selected date was still empty on first render
- Log page top padding; ring/rep count scaled to 20% above original size

### 2026-07-02 (log page UX refresh)

**Shipped**
- Log page: progress card above ring; bank button hidden until ring interaction; ring 10% larger with centre tap +1
- Ring drag incremental-only fix (no jump to 10 on grab)
- Feed tab: Group / My log segments; personal history calendar + daily entries moved off Log page

**Next**
- Manual spot-check ring drag on real phone; Feed My log calendar on past months with data

**Notes**
- Lint follow-up on open-app availability hook after merge

### 2026-07-01 (Android Open in app intent)

**Fixed**
- Open in app on Android Chrome now tries `window.open` then an Android intent URL so the installed WebAPK can launch
- Manifest `launch_handler` set to `navigate-new` for captured launches

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
