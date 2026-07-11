# Changelog

All notable user-facing and operational changes to PushUS are documented here.

This file records **meaningful** changes — not every small fix or Cursor task. Day-to-day notes go in [docs/dev-log.md](docs/dev-log.md).

Format based on [Keep a Changelog](https://keepachangelog.com/).

---

## Unreleased

### Fixed

- **PWA self-recovery instead of a black screen:** if a broken/stale JavaScript bundle prevents React from starting, a small HTML-level guard now reloads the latest build once, then shows a visible “Reload PushUS” recovery screen instead of leaving the Home Screen app black
- **Blank app after deploy (Cloudflare asset cache):** a mid-deploy race cached `index.html` under the new `/assets/index-*.js` URL for CORS requests (module scripts send `Origin`). Browsers then refused the “JS” file as HTML and React never mounted — empty screen on every device. Asset cache is no longer `immutable` (5-minute revalidate) so a poisoned entry can’t stick for a year
- **iOS blank screen (hydrate hang):** even after session recovery, profile/group fetches could hang forever on a suspended auth client and leave the Home Screen app on an empty loader. Boot now has an 8s watchdog, profile/access/group reads time out at 5s, the loader shows “Loading…”, and returning to the foreground refreshes an existing session
- **iOS blank screen after auth fix:** session recovery could hang inside Supabase's auth lock / network refresh and leave the Home Screen app on an endless loader. Recovery is now deferred off the auth callback, capped at 6s, and gated so cold-launch `pageshow` cannot race the first hydrate
- **iOS PWA login after magic link:** the email link always opens in Safari, and iPhone keeps Safari storage separate from the Home Screen app — so signing in never reached the installed PWA. PushUS now copies the session through Cache Storage (shared on iOS) and asks you to reopen the Home Screen icon after Safari finishes sign-in
- **iOS PWA login persistence:** reopening the home-screen app after it has been backgrounded no longer drops you back to the magic-link screen when a refresh token is still on the device — the app now retries session recovery on cold start and when the PWA returns to the foreground (common when iOS suspends background token refresh)

---

## [1.5.0] - 2026-07-11

### Added

- **Social notifications:** you now get a push when a mate adds you, accepts your request, challenges you to a 1v1, or reacts to your sets — so the mates-and-challenges loop actually reaches people instead of waiting silently in the app. Reactions are batched (a flurry is one buzz), and there's a "Social notifications" toggle in Settings → Notifications to turn them off
- **Leave a challenge:** you can now leave a challenge you joined — and, on team challenges, drop your team spot — from the challenge page, as long as it hasn't ended. A two-tap confirm prevents accidents
- **Mute the sound effects:** a "Sound effects" toggle in Settings → Appearance turns off the ticks while you dial reps and the lock-in sound when you bank

### Changed

- **Group admin has its own page now:** the group-management tools (join requests, member moderation, invites, badges, billing) moved off the main Settings screen behind an admin-only "Group admin" link. Personal settings and group settings were mixed on one page, which made it unclear whether you were changing your own preferences or the whole group's

### Fixed

- **Shared mate links just work now:** opening a mate link used to fail unless you were already signed in and in the same group. It now works whether you're signed in, in a different group, or brand new — a signed-out visitor gets a sign-in prompt and the link is remembered through sign-in, then redeemed automatically once you're set up (mate connections are cross-group by design)
- **Custom activity rows no longer wrap awkwardly:** a long name (e.g. "Calf raises (single leg)") and its "Left / right tracked" label were squeezed by the Edit/Archive buttons into a clipped name over three cramped lines; each now stays on one clean line
- **Where 1v1 battles live is clearer:** the Mates screen now says a 1v1 battle starts from a mate's card once they accept your request, so it's findable before you have any mates
- **Accessibility & polish pass:** the log check-in sheets (effort / soreness / over-target / nose-tap) now move focus in on open, close on Escape, and restore focus on close; more controls meet the 44px touch-target floor and show a keyboard-focus ring; the centre-hold ring now fills exactly as the 1.5s nose-hold completes; and a batch of smaller copy, layout, and labelling nits across the app were tidied
- **Clearer daily-plan card:** the compact plan card on the Log screen dropped its cryptic three-number row ("~5 / BANK NEXT") for a plain-language line — "Bank about 5 — set 2 of 3" — with a progress bar and a simple "X of Y today · [day type]" summary underneath
- **More polish:** arming a solo challenge join now has a "Not now" to back out; a team's intensity warning shows on the team you're actually joining; adding a mate shows a friendly "Adding your mate…" state instead of a bare loader; the training wizard's single-choice pickers announce as radio groups; the onboarding emoji picker and the group-admin billing row are properly labelled and consistent; and the trial banner reads "Trial ended" once it lapses instead of counting into negative days

---

## [1.4.0] - 2026-07-11

### Added

- **Log a set you forgot yesterday:** in My log (Feed → your log), pick yesterday on the calendar and add the set you missed. You can log and edit today and yesterday; older days stay locked so scores stay fair
- **"How PushUS works" page:** a new Settings → About page that lays out the rules in plain language — including a beginner **"reps & sets in 20 seconds"** primer for people new to working out (what a rep and a set are, what "2 sets of 8" means, and that you just log the number of push-ups you did), plus the honour system, the today/yesterday logging window, 1 push-up = 1 XP, streaks and freezes, badges, and the board
- **XP feedback when you bank:** banking push-ups now shows the XP you earned (e.g. "24 push-ups banked · +24 XP"), so progress is visible on every set — not only when a badge happens to unlock

### Changed

- **Edit yesterday, not just today:** members can now correct their own sets for yesterday as well as today (matching the group's default backdate window); older days remain locked and deleting stays same-day. Previously any edit of a past day was rejected with "same-day edit only"
- **Push reminders wording:** the Notifications settings now make explicit that reminders only nudge during your chosen hours and **stop for the day once you've banked all your sets** — the behaviour was already true, but the copy didn't say so
- **Clearer "banked" confirmation:** the toast after banking has a larger, easier-to-hit Undo (now a pill) and close button, plus a tidier layout, so it's less in the way
- **Ring sits closer to +10:** on the Log and guest screens the counter ring now hugs the `+10` button (its internal whitespace is absorbed) and sits a touch lower, so both fall in the natural thumb zone
- **Set effort check-in shows its hints:** "How did that feel?" now shows the guidance under each option (Easy — "Plenty left in the tank", etc.), matching the soreness check-in
- **Training-plan setup polish:** the wizard's choice buttons now give press feedback, and the "max clean set" slider shows its 1–60 range
- **Clearer "Injured" vs "Sub out":** the Availability card now says up front that both do the same thing — pause your reminders, pause your plan, and protect your streak — and that the only difference is what your group sees, with a one-line note under each button. The two confirmation messages no longer imply that subbing out does less

### Security

- **Members can't self-edit around an admin review:** editing an entry recomputed its oversize-review status from the new count, so a member could shrink a rejected or pending entry back under the cap and have it silently count again (and admins couldn't re-reject it). Entries under admin review are now un-editable by members — admins still manage them. This also closes the same behaviour that existed for same-day entries

### Fixed

- **Board score no longer gets cut off:** on the day board, a member's score (e.g. "10/10") could be clipped to "10/1" on narrow phones because the name column reserved a fixed width and pushed the score off the edge. The name now shrinks/truncates so the score always shows in full
- **Tab names now match their headers:** the bottom nav says "Board" and "Feed", but those pages' headers read "Leaderboard" and "Activity" — two names for the same tab. The headers now say "Board" and "Feed" too, so what you tap is what you land on
- **Rotating your mate link / cancelling a battle now confirm:** both actions could fail silently — no error message, and (for rotate, a security action) no confirmation the old link was actually killed. They now show a success toast and surface any error instead of failing quietly
- **Deleting an entry now asks first:** on your logged sets, the Delete button removed the entry on a single tap — permanently, adjusting your total/streak/XP, and sitting right next to Edit. It now arms to "Confirm?" on the first tap and only deletes on the second (auto-cancels after a few seconds), matching the custom-activity list
- **Deleting a group badge now asks first:** the admin badge list deleted on a single tap and gave no feedback if it failed. It now arms to "Confirm?" and shows a success/error toast, matching the create and award actions beside it
- **Screen-reader labelling of segmented toggles:** the range/metric/chart toggles (Board, Leaderboard, progress chart) announced themselves as "tabs" but had no tab panels or arrow-key model. They're now correctly exposed as a group of pressable buttons, so assistive tech describes them accurately
- **Challenge intensity picker accessibility:** the Fun/Moderate/Hard/Stupid selector showed its choice with colour only (no screen-reader state) and had no visible keyboard-focus ring. It's now a labelled button group with pressed state and a focus outline
- **Training wizard selectors accessibility:** the soreness, experience-level, training-days, and challenge-intensity pickers in the training-plan setup had the same gaps — colour-only selection and no keyboard-focus ring. All four are now labelled button groups with pressed state and focus outlines
- **See all past challenges:** the Challenges page silently showed only the 5 most recent finished challenges. It now says how many there are and offers "Show all N past challenges" so older ones aren't lost
- **"Invite required" screen had no way to enter a code:** when group creation is locked (private beta) and you had no saved invite, the screen told you to "join with your invite link" but only offered a "Back" button. It now always offers "Enter an invite code" so you can actually paste one
- **About page back button:** the "← Back" on the About page always went to Settings, which bounced logged-out visitors (who reach it from the sign-in footer) to a page they can't open; it now returns to wherever you came from. The bottom "Sign in" button is also hidden when you're already signed in
- **No way back from full-screen pages:** Challenges, a challenge's detail, Mates, and Achievements hide the bottom nav but had no back button — so on a home-screen app (no browser bar) you could get stuck with no way back to your group. Each now shows a back link in the header (← Group / ← Challenges), matching Billing
- **Join failure recovery:** when joining a group by invite link failed, the error screen's "Back" button dropped you on the private-beta gate ("you need an invite to continue") — a mislabeled button and the wrong destination. It now offers "Enter a different code" back to the join screen, matching the invalid-link screen's recovery
- **Trial banner said "0 days":** on the day a trial expires, the banner and the billing panel read "ends in 0 days"; they now say "ends today"
- **Guest-mode delete now confirms too:** deleting a guest set was a single instant tap with no undo — in the one mode where reps are explicitly device-only. It now arms to "Confirm?" first (auto-cancels after a few seconds), matching the rest of the app
- **"Create challenge" button no longer wraps** to two lines on narrow phones, the "Moderate" intensity label (and the others) now fit cleanly, and every intensity tap gives feedback
- **App name is honoured consistently:** the sign-in footer and the invite link/share message hardcoded "PushUS" instead of the configured app name — a renamed deployment now brands correctly, and the login header and footer no longer disagree
- **Segmented toggle labels keep their casing:** the Board and progress toggles force-capitalised every word ("Best set" → "Best Set", "Most improved" → "Most Improved"); they now render as written
- **Team-challenge join warning was page-wide:** arming a warning-intensity join flipped *every* team's button to "Confirm" and could let a mis-tap join a different team without seeing its warning; it's now scoped to the team you tapped
- **Achievement progress bars:** the lifetime-club bars weren't exposed to screen readers and rendered empty until ~1% progress; they're now proper progress bars and show a sliver for any real progress
- **Assorted copy, layout, and tap-target polish:** the achievements empty state no longer reads like dev notes, nudge buttons and challenge-card headers no longer overflow on small phones, longer leaderboard names show more before truncating, list Edit/Delete controls meet the touch-target floor, and a mid-sentence capitalisation on the no-plan card is fixed
- **Push reminders no longer show yesterday's number:** a reminder generated on an earlier day could sit in your notification tray and show a stale count (e.g. "do 10") that no longer matched today's plan. Reminders now clear when you open the app, tapping one dismisses the rest, and an undelivered reminder expires instead of arriving hours later
- **Reminder target matches what the app shows:** for members whose daily target is calibrated from their own logging, the reminder could work out a lower number than the Today screen showed; it now reads the same plan data
- **Logging stays responsive right after you bank:** the counter no longer ignores taps and drags for up to ~2.4s while the ring spins down, and the spin-down now respects Reduce Motion
- **"Log it anyway" banks exactly what it warned:** when you go over your set, the count can no longer drift while the confirmation sheet is open, so the number you confirm is the number that gets logged
- **A way out of "Max set mode":** you can now leave max-set mode without banking, and switching activity no longer logs a normal set as a max check-in
- **Nose-tap mode asks before discarding:** exiting with reps counted now confirms first instead of silently dropping them
- **Plain-language errors on create / join / onboarding:** raw database messages are replaced with clear ones (name already taken, invite expired, you're offline, …)
- **Achievements and Mates recover from load errors:** if their data fails to load they now show a "Try again" state instead of looking empty
- **Training setup needs at least one day:** the plan wizard no longer lets you continue or save with zero training days selected
- **More assorted polish:** the progress chart's date labels no longer overlap on the two-week view, full-screen pages use the safe viewport height so nothing hides behind the mobile browser bar, more controls show a keyboard-focus ring, and a couple of dead style classes were fixed

### Performance

- **Smoother Feed, Board, and calendar.** The group feed no longer rebuilds its reaction state or re-parses every timestamp on each background refresh; leaderboard rows and day-log entries only re-render when their own data changes; the rep calendar stops rebuilding its month grid every time you tap a day. Less work per interaction, most noticeable on older phones with long lists
- **Fewer background refetches.** Queries no longer refetch every time you switch back to the app — data still updates immediately after you bank, react, or edit — saving battery and data on app-switching
- **Lighter Log screen.** The effort, soreness, over-target, and max-set sheets now load only when first opened, trimming the initial app download
- **Banking refreshes less.** Logging a set now only refreshes the calendar month it lands in and the leaderboards that actually include that day, instead of every board and month you'd browsed

### Docs

- Added `AGENTS.md` — a contributor/agent guide (architecture, commands, performance rules, design tokens, versioning workflow, and areas to touch carefully)

---

## [1.3.0] - 2026-07-08

### Added

- **App-wide motion & haptics:** a shared motion vocabulary (`src/styles/motion.css` + `--ease-spring` token) now runs through the whole app — progress charts draw themselves in ("yarn chasing the dot": a leader dot races along the data path with the line trailing elastically, dots popping as it passes, ping on landing), leaderboard rows glide to new ranks (FLIP), the rep calendar cascades in like a page turn, sheets/popups slide and spring in and out, pages and lists rise with staggers, stat numbers count up, progress bars shimmer while filling and flash green on goal, crossing the daily goal pulses the Today card with a success ring + haptic, and buttons/tabs/segments/chips/reactions give light haptic ticks. The Achievements streak flame flickers only while today is unbanked (with a milestone pulse at 7/14/21/30/50/75/100+ days), and the social surfaces speak the same language — nudges, mate accepts, and challenge creates kick back a success haptic, 1v1 battle scores and you-vs-mate stats count up, challenge standings glide as ranks change, and the mate-link handshake pops. All entrances respect `prefers-reduced-motion`
- **Light mode:** full light theme with a Settings → Appearance toggle (Light / Dark / System). Defaults to following the phone; theme resolves pre-paint (no flash); nose-tap mode stays dark by design. Meta theme-color and native controls follow the active theme
- **Mates:** consent-based mate connections separate from groups (migration `0032`). Request mates from shared groups or share a personal **mate link** (rotatable); accept/decline, remove, and block. Mates see aggregate stats only (today / 7-day / 30-day / best day) — never individual entries or group data
- **Mate nudges:** 💪 push them / 👏 cheer / 😤 stir up — sends a push notification to your mate (via the `send-nudge` edge function), limited to one per mate per day, respecting their quiet hours and injury pause
- **1v1 mate battles:** challenge a mate to a 1, 3, or 7-day rep battle; live you-vs-them score, countdown, and result on the Mates page
- **Mate board:** 7-day totals leaderboard across you and your mates (cross-group aggregate)
- **Group challenges:** admins can create challenges with one-day / weekend / 7 / 14 / 30-day / custom-date formats and leaderboard, group-target, or team-vs-team types (one-off teams). Fun/Moderate/Hard/Stupid intensity — Hard and Stupid warn before joining. Members join from the challenge page; **late joiners score from their join day** (no backfilled wins); winner banner on ended challenges
- **XP goes live:** 1 push-up = 1 XP awarded automatically on bank (DB trigger, migration `0031`), with history backfilled. Edits, deletes, and rejected entries adjust XP down. Total shows on Achievements
- **Achievements go live:** seeded badge catalog (First Bank, Big Banker, Monster Set, Fifty/Century/Double Century Day, 1k/10k/100k Clubs, Week Streak, Monthly Machine, Early Bird, Night Owl) with server-side unlocks on bank and historical backfill
- **Streaks + freezes:** active streak (rest days protected) on the Achievements page and one streak freeze per week — "Protect yesterday" covers a missed day without faking reps
- **Custom reminder frequency:** every 30 minutes, hourly, 2 / 3 / 4 hours, or once daily (migration `0030`; legacy column kept in sync for older cached clients)
- **pg_cron scheduling:** run reminders from inside Supabase every 15 minutes via `supabase/snippets/schedule-push-reminders-pg-cron.sql` — replaces jittery GitHub Actions cron (kept as documented fallback)
- **Locked reaction set:** feed reactions expanded to 💪 🔥 😂 👏 😤
- **Admin entry review:** entries held by the oversize policy appear in Settings → Group admin for approve/reject (rejected entries stop counting everywhere, including XP); oversize policy (warn / block / review) and **feed visibility** (full entries / daily totals / leaderboard totals) are now configurable in-app (migration `0033`)
- **Group hub cards:** Mates, Challenges, and Badges entry points on the Group tab
- **Push reminder ding fix:** repeated reminders replaced the tray notification silently on Android — `renotify` now makes every reminder sound; eligibility also allows 10 minutes of scheduler slack so cron jitter can't skip whole hours
- **What's new popup:** returning members see a one-time popup listing major features launched since their last visit (tracked per device); members who joined after a launch never see it. Signed "Love Rhys + MK 🧡" while in beta. Add entries to `src/lib/whatsNew.ts` when shipping a major feature
- **What's new history (Settings):** every launch announcement lives at Settings → What's new, grouped by date with the app version it shipped in; the popup links to it via "See past updates"
- **Custom activities:** track any exercise just for you (calf raises, pull-ups, leg raises) with optional separate left/right sides. Manage in Settings → Custom activities; a compact switcher pill appears above the Log page ring once you have one. Custom reps are private — never on the group feed, board, or training plan
- **Activity icons:** custom activities use a minimal line-icon set themed to the app instead of emojis. The picker leads with the top 10 exercises people track (pull-ups, squats, sit-ups, dips, lunges, plank, calf raises, leg raises, jumping jacks, dumbbell curls) with equipment/generic marks behind a "More icons" toggle; push-ups is the brand bolt everywhere. Legacy emoji values still render
- **My progress chart** on the Board: dependency-free SVG trend chart for push-ups or any custom activity — daily (2 weeks) or weekly (12 weeks) buckets, Total or Best set metric, left/right lines for sided activities, and a this-week vs last-week delta
- **Board privacy — public rep totals:** opt-in Settings toggle to show your raw rep totals to group mates on the day board instead of a % of goal (week/month boards already show totals)
- **+10 quick add** button between the ring and Bank so sets of 10 don't need a full lap drag
- **Nose-tap mode:** fullscreen tap-to-rep overlay for logging with your nose mid-push-up, with a synth confirm sound and vibration per tap. Four selectable, saved skins: Bricks (2.5D brick floor that quakes outward from the tap point), Classic flash, Ripple, and Burst
- **Bank lock-in ritual:** banking runs an S-curve unwind to zero with an ascending trill per rep (chord accents at 5 and 10), then a lock-in animation (expand, click-clack, settle beat, slam) with a glow flash and a BANKED stamp
- **Synth sound cues:** all logger and bank audio is Web Audio synthesis (`src/lib/dinkSound.ts`) with no asset files; production spec for an audio engineer in [docs/audio-spec.md](docs/audio-spec.md)
- Dev-only `/dev/preview` route (excluded from production builds) to view the logger and nose-tap mode without auth or a backend
- Installable Android and iOS PWA setup with generated app icons, iPhone home-screen metadata, and a bottom-dock install prompt for more reliable reminders
- **Open installed app prompt:** when a member opens PushUS in the mobile browser but has previously used the home-screen app (or Android reports the web app installed), a bottom dock nudges them to open PushUS from the home screen instead
- Optional profile **name initial** (single letter, e.g. Rhys E) on onboarding and in Settings
- **Personal mate labels** on the Group Members list — tap a mate to rename for yourself; synced to your account; shown as `Your label (their name)`
- **Feed → My log:** personal rep history with month calendar, daily totals, and set list (moved from Log page)
- **Centre tap on ring:** tap inside the dial to add one rep (hands-free / nose-friendly logging)
- **iOS PWA support:** home-screen install meta tags, PNG app icons, manifest `id`/`scope`, and in-app guidance when push reminders need Add to Home Screen on iPhone/iPad

### Fixed

- **Feed reactions on mates' entries:** tapping an emoji on a mate's feed entry now highlights instantly and sticks. The reaction was saving to the database, but the button never lit up — the mutation refreshed the wrong React Query key, so the "your reactions" state never updated. Now optimistic (the button flips immediately) and reconciled with a prefix-matched invalidation
- **Theme colour + light-mode phones:** `theme-color` meta and manifest `background_color`/`theme_color` now match the app background (`#0a0a0d` instead of navy `#0b1220`), and `color-scheme: dark` keeps native controls (selects, checkboxes, scrollbars, pickers) dark on phones set to light mode
- **PWA icons on dark Android:** app icon, home-screen shortcut, and push notification badge now use a flat purple lightning bolt (Resvg-safe) instead of rasterising favicon masks/filters that rendered as an invisible black silhouette on dark backgrounds

### Changed

- **Visual restyle (chunky glow):** near-black background, hot-orange gradient pill buttons with layered glow, thicker card borders, and bigger radii. Circular logger ring is about twice as thick with rim highlights, a glowing gradient arc, and a knob-style handle
- **Log page layout:** compact training-plan strip on top, ring centred beneath it, and the Bank CTA directly below the ring (always visible; disabled at 0 reps); today's entries live in Feed → My log
- **Lap-based ring fill:** the ring fills one full lap every 10 reps and starts a fresh lap in a new colour on the next rep, ramping from cool to hot across 10 laps (up to 100 reps). Completed laps sit under the current lap as a solid ring
- **Logger feel:** the current lap draws as a tapering comet "snake" — a bright glowing head at the handle that thins and fades back to the lap start; per-rep ratchet tick sound and haptic while dragging, accented at 5 and 10
- **Nose reps gesture:** hold the centre of the ring for 1.5 seconds to open nose-tap mode (replaces the separate button). A dismissible hint under the ring teaches the gesture, with a "Don't remind me again" option
- **Feed reactions take less room:** the five-emoji bar on each feed entry now collapses to a single compact **React** pill (which shows your active reactions when you've reacted); tapping it reveals the palette inline. Long feeds are no longer a wall of buttons. The **Compact** density now packs noticeably tighter than **Comfortable** — smaller avatars, tighter rows, and smaller reaction controls
- **Sign-in page fits one screen:** the login page now fits a standard large phone (e.g. S24/S25 Ultra) without scrolling — the invite-code field + Continue are collapsed behind a "Got an invite code?" toggle by default (most people sign in with email/Google), and vertical spacing was tightened
- OG social share images regenerated to match the new palette
- **Ring handle grab zone:** larger thumb-sized hit target around the orange dot; easier to start a drag when you're near the handle, not only on the dot
- Circular logger ring **20% larger** (rep count scaled to match); drag is incremental only (no jump to rep 10 on grab)
- Log page adds top breathing room equal to the progress card height

### Fixed

- **Reset open-in-app dock:** Settings → Push reminders shows **Show it again** when the bottom dock was permanently dismissed; **Open in app** also clears the dismiss
- **Open in app dock after PWA install:** manifest serves absolute `related_applications` URL per origin for `getInstalledRelatedApps()`
- **Push settings duplicate error:** install hint no longer repeats in red when tapping Enable reminders without an installed PWA
- **Bank Push-ups disabled state:** uses secondary button styling at 0 reps so label stays readable
- **Nose-hold hint dismiss link:** higher contrast on "Don't remind me again"
- **Android install dock after uninstall:** shows manual Chrome menu steps when `beforeinstallprompt` is unavailable (Add to Home screen / Install app)
- **Push reminders require installed PWA:** Android and iOS block enabling reminders in a normal browser tab; toggling reminders re-checks install status via `getInstalledRelatedApps()` and re-shows the install prompt when needed
- **Stale PWA install detection after uninstall:** clears the local install flag when Android Chrome reports no related webapp, so the install dock can appear again
- **Open in app on Android:** launches the installed WebAPK via `window.open()` to an in-scope https URL in a new tab (`noopener,noreferrer`) — the only reliable web method on Chrome Android. Added canonical `manifest.json`, aligned `start_url` to `/today`, and restored a primary **Open in app** button on the dock
- **Bottom dock prompt design:** floating card with accent bar, stronger shadow, full-width stacked buttons on mobile success, warning, danger, and accent notifications now use opaque surfaces instead of 10–30% transparent tints, so copy stays legible when toasts float over page content (e.g. invite copy confirmation on Settings)
- **Bottom dock prompts:** install, open-app, and push reminder docks use a solid surface panel with clearer secondary buttons; tab pages reserve scroll space so content is not hidden behind the dock
- **Settings training plan:** weekly day chips use stronger borders, a filled background, and highlight today in the member timezone the "hold centre for nose reps" teaching hint now sits below the Bank Push-ups button at the bottom of the Log page, and no longer hides when you start dragging (which was shifting the ring upward in the centred layout)
- **Open in app now launches the installed PWA:** the button used a plain `intent://` https URL, which Chrome just reloaded in the browser tab (it can't target the WebAPK). It now navigates to a registered custom protocol (`web+pushus://open`, declared in the manifest) so Chrome hands off to the standalone app. Members on an older install must reopen the app once to update it before the hand-off works
- **Log summary shows the set plan:** the compact daily summary is now a clean three-stat row — current set (e.g. "3 of 4"), reps to bank next (e.g. "~12"), and today's total (e.g. "12/45") — so the per-set target and set progress are always visible at a glance
- **Open in app button hidden on Log page:** the open-installed-app dock now sits above the bottom nav on `/today` (it was pinned to the screen bottom, so its buttons rendered behind the nav bar). Guarded by a unit test; see [docs/pwa-open-in-app.md](docs/pwa-open-in-app.md)
- **Theming tokens:** colours are now RGB-triplet tokens with `<alpha-value>`, so Tailwind opacity modifiers (`border-accent/50`, `bg-danger/15`) emit real CSS. They previously produced nothing
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
