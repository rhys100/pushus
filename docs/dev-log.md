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

### 2026-07-08 (design-audit loop — silence React Router v7 future-flag console spam)

- **The console was emitting ~192 React Router "future flag" warnings per session** (`v7_relativeSplatPath` + `v7_startTransition`), repeated on every route render. Not errors, but the noise buries real console output — it literally slowed a console-log audit this pass. Opted into both flags on `<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>` (`src/main.tsx`). Safe here: the app uses **only absolute `to="/…"` links** (grep found zero relative ones), so `v7_relativeSplatPath` is a no-op; `v7_startTransition` is the recommended opt-in and pairs well with the lazy/Suspense routes. Bonus: readies the eventual v7 upgrade. Verified live: after a fresh `/guest` boot with the flags, a marker-bracketed console capture showed **zero** new router warnings (the leftover ones in the buffer are all pre-fix history), and routing/navigation still works. tsc + lint clean.

### 2026-07-08 (perf: kill the Day-board N+1 with a batched RPC — deployed to prod)

- **The Day board fired one `user_volume_stats` RPC per member** (~N round-trips; for a non-admin viewer N-1 of them *failed* since that RPC restricts non-admins to their own stats). Replaced with **migration `0040_group_volume_stats`** — a single batched RPC returning per-member stats in one call, with the **identical permission model** (caller always; every active member only if the caller is a group admin) and byte-for-byte the same per-user output as `user_volume_stats` (same 30-day window, same filters, all-time last-log, RIR-filtered estimated max, zeros/NULL parity). `useGroupDailyTargets` now makes **1 call instead of N**; members not returned resolve with null stats exactly as before, and the call is wrapped in try/catch so a batch failure degrades gracefully to no-stats (board never breaks).
- **Verification (production, `zcwvvhuihqlldnbwhivl`):** adversarially reviewed by 3 independent lenses (parity / security-RLS / SQL-validity) — all *safe-to-deploy*, no blockers. `--dry-run` confirmed only `0040` pending (no drift; remote was at `0039`), applied via `supabase db push`, `migration list` now shows `remote:0040`, and an anon RPC call returns the expected `P0001 Authentication required` (function reachable, granted, guard fires). tsc + lint + 436 tests green; all routes boot clean.
- **The other deferred item (narrowing the `['leaderboard']` bank invalidation) was investigated and intentionally NOT changed:** `invalidateQueries({ queryKey: leaderboardKeys.all })` uses RQ v5's default `refetchType:'active'`, so it already refetches only the one mounted range×metric variant and merely stale-marks the rest (so they're fresh on switch). It's already one refetch per bank; narrowing would save nothing and risk stale data on metric switch.

### 2026-07-08 (feed reactions redesign — Discord/FB style, user-reported)

- **Reactions were too small and the picker stayed open** (user-reported: "reacts are so small … when u react the whole thing stays open … not like fb/discord where it just shows emojis and u can add +1 and join in"). Rebuilt the feed reaction UX:
  - **Existing reactions now render as per-emoji count chips** (`💪 3`, `🔥 1`), your own highlighted in accent, and **tapping a chip joins in / takes yours back** (+1 / −1) — the FB/Discord pattern. The full emoji palette is behind a **`+`** and **closes as soon as you pick** (no more staying open); entries with none show a `🙂 React` button.
  - **Bigger touch targets:** palette emoji buttons 44×44px (were 32/24px), count chips ~54×36px.
- **Data:** the feed only sent a total `reaction_count` + your own reactions — not enough for per-emoji counts. Added `useEntryReactions` (renamed from `useUserEntryReactions`) which now fetches **all** group reactions for the visible entries (`fetchEntryReactions`, RLS already allows group members to read them via `reactions_select_active_members`), and `GroupFeedPanel` aggregates them into per-entry `{ emoji, count, mine }` summaries. Optimistic toggle updated to key on `user_id` so only your row flips (others' counts stay). No migration.
- **Perf preserved:** aggregation is `useMemo`'d on the raw rows (+ `user?.id`); rows stay `React.memo`'d with a shared `EMPTY_REACTIONS` const for entries with none, so background refetches with equal data still re-render zero rows.
- **Verified live** on `/dev/preview` (added a `FeedReactionDemo` + exported `ActivityFeedRow`): chips = 54×36 / palette = 44×44 measured, and tapping `💪 3` → `💪 4` + highlighted (join-in works). tsc + lint clean, 436 tests pass, all six routes boot clean.

### 2026-07-08 (design-audit loop — sign-in-failed screen consistency + a11y)

- **The magic-link callback error screen was the app's weakest recovery point.** On `AuthCallbackPage`, a failed sign-in showed "Sign-in failed" + the error, then a tiny raw `<a href="/login">` text link — a full-page reload, a ~16px tap target, and inconsistent with every other screen (which uses buttons). It also had no `role="alert"`, so screen readers never announced the failure. Reworked to match the app's error pattern (⚠️ + heading + muted detail) with a full-width `ButtonRouterLink` "Back to login" (48px target, client-side nav) and wrapped it in `role="alert"`. Verified live at `/auth/callback` (the error state renders when there are no valid auth params): `role="alert"` present, button 48px, href `/login`. tsc + lint clean.

### 2026-07-08 (dark PWA icon on Android — root-caused to CDN immutable cache, user-reported)

- **User: "reinstalled and the same dark icon appeared — thought it got fixed."** It *was* fixed in code (commit `87562e4`, purple bolt `#863bff` on navy `#0b1220`, committed + on `origin/main`, and the deployed build `5643a50` regenerates it). Root cause is caching, not code: `public/_headers` marked `/pwa/*` as `Cache-Control: public, max-age=31536000, immutable`. Those icons have **stable filenames** (`maskable-512.png` etc.) whose bytes change on regen — but `immutable` tells Cloudflare's edge to never revalidate, so it kept serving the pre-fix **black-silhouette** icon. Proven live: plain URL → 8577 bytes, `Cf-Cache-Status: HIT`, `Age: 441342` (~5 days); same URL with a `?cb=` cache-buster → 5219 bytes (the purple icon), `MISS` from origin. WebAPK icons compound it — Chrome bakes the icon in at mint time and doesn't re-mint just because bytes changed at the same URL, so uninstall/reinstall pulled the CDN's stale copy.
- **Fix (code):** `/pwa/*` → `public, max-age=3600, must-revalidate` so regenerated icons propagate (kept `/assets/*` immutable — Vite fingerprints those filenames, so it's safe there). **Immediate manual step for Rhys:** purge the Cloudflare cache for `/pwa/*` (dashboard → Caching → Purge, by prefix or everything), then uninstall + reinstall the PWA — the mint will fetch the fresh origin icon. **Robustness follow-up (offered, not done):** fingerprint the icon filenames (hash/version in the name) so immutable caching is safe AND each icon change forces a WebAPK re-mint for existing installs.
- **Separately (search discoverability):** the app shows in Samsung's app-drawer Finder (searches installed launcher labels) but not in the Google search bar's "From your apps" — expected WebAPK/PWA behaviour, not a bug: Google's global app search indexes Play-installed/AppSearch apps, which Chrome-minted WebAPKs don't feed. The real fix is publishing the TWA to the Play Store (also resolves the earlier Play Protect "unsafe app" flag on sideload).

### 2026-07-08 (design-audit loop — pending-approval screen clarity)

- **`PendingPage` felt like a dead end even though it auto-advances.** Two fixes on the screen every new member sees while waiting for admin approval: (1) removed the redundant second sentence — it had "Waiting for the group admin to approve you." *and* "An admin needs to approve your request before you can log push-ups." saying the same thing twice; now one line. (2) The page already polls membership + group name every 15s and whisks the member in on approval, but nothing said so, so "Check again" read as the only way forward and invited anxious tapping. Added an `aria-live` "Checking automatically — you'll go straight in once approved." line (with a small accent dot, matching the feed's text-based "Refreshing…" pattern rather than adding new animation), relabelled the button "Check now", and gave it a proper loading/disabled state via a new `isChecking` flag so a manual tap shows progress. Auth-gated (only pending members see it) so verified via tsc + lint, not live preview.

### 2026-07-08 (design-audit loop — join failure recovery destination)

- **Join-by-link error screen sent users to the wrong page.** On `JoinPage`, if `request_join_group` failed for any non-"already a member" reason (bad/expired code, group full, network), the error state's secondary button was labelled **"Back"** but linked to `/private-beta` — the beta-access gate, which greets a logged-in, onboarded user with "you need an invite link or approved access to continue." Both the label and the destination were wrong for the situation. Changed it to **"Enter a different code" → `/join`**, mirroring the `!inviteCode` invalid-link state directly above (which already offered `/join`). One-line recovery that actually maps to the user's goal. `/join` verified live (renders the invite-code entry); tsc + lint clean. The error state itself needs a real failed-join RPC + session to reach, so not live-previewable — routing + destination confirmed instead.

### 2026-07-08 (perf-audit loop — calendar + day-log memoization)

- **RepCalendar month grid `useMemo`'d** on `[monthStart, todayDate]`. Tapping a day changes `selectedDate`, which re-rendered the calendar and re-ran `startOfWeek/endOfWeek/eachDayOfInterval/parseISO` for the whole ~42-cell grid every tap. Now that derivation only recomputes on an actual month/today change.
- **`EntryRow` (day-log) is `React.memo`'d** and its timestamp is `useMemo`'d on `[created_at]`. Editing/deleting one entry, or an optimistic bank/undo, no longer re-parses every other row's time; with structural sharing, unchanged rows don't re-render at all.
- **CircularLogger `setCountPulsing` guard — evaluated and skipped.** The audit flagged `setCountPulsing(true)` firing when already `true`, but React bails out of re-render on identical primitive state (`Object.is`), so it's already a no-op; adding a `countPulsing` read into the hot pointer-drag handler would risk a stale-closure bug in a flagged high-risk file for zero real gain. Left untouched.
- Verified: tsc + lint clean, 436 tests pass, all six routes boot with no page errors. (v1.3.0 was cut separately by the release commit, so this perf work now accrues to the next Unreleased cycle.)

### 2026-07-08 (release: cut v1.3.0 + guard against under-versioning, user-reported)

- **Cut v1.3.0 (user-reported: "we've done ~50 commits and it still says v1.2").** The whole Unreleased backlog — mates + nudges + 1v1 battles, group challenges, XP/badges/streaks, light mode, guest mode, custom activities, reminder reliability, app-wide motion & haptics — had been piling up under 1.2.0 with no release cut. Rolled it into `## [1.3.0] - 2026-07-08` (all additive/non-breaking → **minor**, matching the user's own "1.3, 1.4" expectation). Bumped `package.json` + `package-lock.json` (Settings shows it automatically via `__APP_VERSION__` from Vite), added the README status row, and tagged the 5 unversioned headline What's New items (mates, challenges, xp-badges-streaks, light-mode, reminder-fix) with `version: '1.3.0'`.
- **Root cause of the drift, made concrete:** `whatsNew.ts` had 5 headline features announced with **no `version`** — we told users "this is new" but never cut the release that would give them a version. Nothing forced a bump: `version:check` only checked *consistency*, and `version:bump` *discarded* the Unreleased notes (a stub replaced them), so cutting a release was lossy and got skipped.
- **Prevent recurrence ("make sure that doesn't happen again"):**
  1. `scripts/check-version.mjs` now **fails** (pre-commit + CI) when more than `MAX_UNVERSIONED_NEWS = 3` What's New items lack a `version` — back-pressure that forces a release before headline features pile up. Parses the `NEWS_ITEMS` array from source (no TS build step), scoped so the `version?: string` type isn't miscounted. Verified: 0 unversioned now (passes); a synthetic 4-unversioned array trips it.
  2. `scripts/bump-version.mjs` now **moves** the Unreleased notes into the new release section instead of wiping them (function replacer, so `$` in notes is safe) — releases are now cheap and lossless to cut, removing the disincentive.
  3. New `tests/unit/whatsNewVersioning.test.ts` asserts the same invariant in the suite (≤3 unversioned, valid semver). Documented the cadence + guard in `docs-maintenance.md` (release table, checklist, "still under 1.2" section).
- Verified: tsc + lint clean, **436** tests pass (431 + 3 reaction-key + 2 whatsNew), `version:check` green at 1.3.0.

### 2026-07-08 (login page fit — S24/S25 Ultra, user-reported)

- **Sign-in page needed a small scroll on a standard large phone (user-reported).** Two changes on `LoginPage.tsx`: (1) the invite-code entry (field + Continue) is **collapsed by default** behind a "Got an invite code? Enter it →" toggle — most people sign in with email/Google, so the code entry was pure bloat for them; expanding is a `showInvite` state that reveals the divider + `InviteCodeEntry` inline. A `?join=` deep-link still captures the code via `setPendingInviteCode`, so invitees don't need the manual field anyway. (2) Tightened vertical spacing: page top padding `2rem→1.5rem`, welcome `mb-8→mb-6` + `mt-2→mt-1.5`, card `space-y-5→space-y-4`, footer `mt-6→mt-5`. Verified live at 384×832 and a conservative 384×720 (address-bar-visible): **no overflow in either**, collapsed intrinsic content ≈ 417px here (this local build has Google auth off + no beta note; even the fullest production config — beta note + Google button — is ≈ 550px, and expanded ≈ 687px, all under 720px). Toggle confirmed to reveal `#inviteCode` + Continue with still no scroll. tsc + lint clean.

### 2026-07-08 (feed reactions — bug fix + real-estate cleanup, user-reported)

- **Bug: "can't emoji your mates in the feed" (user-reported).** Reacting to a mate's entry *did* write to the DB, but the button never lit up, so it read as broken. Root cause: a React Query **key mismatch**. The "your reactions" query is keyed on the whole feed's entry-id list (`userReactions(groupId, [...entryIds])`), but `useToggleReaction`'s `onSettled` invalidated a *single-entry* key (`userReactions(groupId, [entryId])`) that never matched the live query — so the highlight state was never refetched. Fix: added a stable `activityFeedKeys.reactionsPrefix(groupId)` (`['activityFeed','reactions',groupId]`) that is an exact prefix of every `userReactions` key, and reworked the mutation to (1) **optimistically** flip the reaction in-cache via `setQueriesData` on the prefix (button lights up instantly), (2) restore the snapshot on error, and (3) `invalidateQueries` on the prefix + feed key on settle to reconcile. Added 3 regression tests asserting the prefix stays an exact leading slice of the full key regardless of entry-id order/length, and is group-scoped (`activityFeedReactions.test.ts`, now 7 tests).
- **Reactions were aggressive on screen real estate (user-reported).** Each feed entry rendered all five 32px emoji buttons inline — on a 50-item feed that's ~250 always-on buttons. Collapsed to a single compact **React** pill per entry (shows your active reactions highlighted when you've reacted, else "🙂 React"); tapping opens the five-emoji palette inline with a × to close. Per-row `pickerOpen` state lives in the already-`memo`'d row. The locked reaction *set* (💪🔥😂👏😤) and no-self-react rule are unchanged — this is presentation only (product-decisions only locks the set).
- **Compact vs Comfortable were "virtually the same" (user-reported).** The old dense mode only nudged padding; the identical reaction bar dominated row height. Now Compact genuinely packs tighter: row padding `px-3 py-1.5` (vs `px-4 py-3.5`), avatar `h-7` (vs `h-10`), body text `0.8125rem`, count `text-sm`, and a smaller `h-6` reaction pill on a shallower indent — roughly 2× the rows per screen vs Comfortable.
- Verified: tsc + lint clean, 431 + 3 new tests pass. Feed is auth-gated and not wired into `/dev/preview` (needs live group/auth context), so no live preview — presentational change, fully typed.

### 2026-07-08 (perf-audit loop — leaderboard row memoization)

- **`LeaderboardRow` now `React.memo`'d** (renders `AvatarChip` + `GoalProgressBar` + `Badge` per row). Every `range`/`metric`/`sinceJoin` toggle or `isFetching` flip previously re-rendered every row. Paired fix: `getMemberDayTarget` (`useGroupDailyTargets.ts`) now returns a shared frozen `NO_PLAN_DAY_TARGET` constant for members without a plan instead of a fresh object literal each call — a new literal per render would have defeated the memo. All row props are now primitives or structurally-shared refs, so a no-op refetch/toggle re-renders zero rows. Verified: tsc + lint clean, 431 tests pass, all six routes boot with no page errors.
- **Deferred (deliberately):** the queued bank-invalidation narrowing (`useTodayData` → narrow the broad `['leaderboard']` invalidate to the active range/metric) touches core banking data flow; after a stale-cache "black screen" scare this session, held it back rather than risk correctness for a marginal win. Revisit with focused before/after testing.

### 2026-07-08 (guest mode layout rework — user-reported)

- **The big guest banner pushed the ring out of the thumb zone and made the page awkward to scroll** (user-reported). Reworked: the account CTAs (Create account / Sign in) moved to a pinned bottom section; the banner became a **slim, dismissible ⚠️ warning bar** (persists dismissed via `dismissGuestWarning`), with the today total folded into the header and the "Guest" chip staying as the persistent reminder. Result (verified live at 375×812): the whole page now **fits with no scroll**, ring centre at **41% viewport** (37% once the warning is dismissed) — back in the natural thumb-swirl zone, matching the real Log screen's spacing. Banking/persistence/milestone toast unchanged.

### 2026-07-08 (design-audit loop — challenge standings "You" label)

- **Challenge standings flagged your own row with only an accent border** — a colour-only signal (fails "don't rely on colour alone") that's easy to miss while scanning for yourself. Added a "You" subtitle + `active` to the self row's `AvatarChip`, matching the Board leaderboard's existing pattern. Border kept, so it's now colour + text. Reuses existing props; auth-gated so verified via tsc + 431 tests.

### 2026-07-08 (design-audit loop — create-group escape hatch)

- **Create-group was a forced path with no escape.** A user routed to `/group/create` post-onboarding (no group yet) who actually wants to join a mate's group by code had no way out — the create form offered only "Create group" (only the invite-locked state had a Back link). Added a secondary "Got an invite code? Join a mate's group instead →" link to `/join`, mirroring how the login screen offers both paths. Isolated, auth-gated (verified via tsc + 431 tests). Flagged for later (not touched — hot file): the post-create success toast promises "send this link to your mates" but lands on `/group`, where the invite link lives in Settings → Group admin rather than front-and-centre; surfacing it on the Group tab would close that loop.

### 2026-07-08 (perf-audit loop — feed re-render storm + focus refetch)

- **Added `AGENTS.md`** — repo-specific working guide for AI/dev agents (flows, stack, commands, architecture, perf rules, design tokens, the enforced SemVer + doc-gate workflow, careful areas).
- **GroupFeedPanel was the app's hottest list.** A perf audit found: a fresh reaction `Set` rebuilt every render, `ActivityFeedRow` not memoized, `parseISO`+`formatDistanceToNow` run per row per render, and non-`useCallback` handlers — so every `isFetching` flip (30s focus refetch) or reaction-pending toggle re-rendered the whole panel and re-parsed ~50 timestamps. Fixed: `React.memo` on the row, `useMemo` the reaction Set (dep `userReactionRows`), `useMemo` the per-item relative time (dep `created_at`), `useCallback` both handlers (stable `mutate` ref). With React Query's default structural sharing, a background refetch that returns equal data now causes **zero** row re-renders.
- **`refetchOnWindowFocus: false` globally** (`src/main.tsx`). A mobile PWA gets foregrounded constantly; every focus refetched any query older than 30s. Mutations already invalidate precisely, so this removes the app-switch refetch churn with no staleness risk. Verified: tsc + lint clean, 431 tests pass, feed module compiles with no page errors.
- **Deferred (needs coordination):** the top audit finding is an N+1 in `useGroupDailyTargets` — one `user_volume_stats` RPC per plan-enabled member on the Day board (~20 round-trips for a 20-person group). The real fix is a batched `group_volume_stats` RPC, i.e. a new migration + backend deploy; left for a coordinated change since the migration chain is being actively extended by feature work.

### 2026-07-08 (design-audit loop — onboarding preview)

- **Live "on the leaderboard" preview on the onboarding profile page.** The page's stated purpose is "how your mates will see you," but it collected an emoji + an *optional* "initial" with no visible result — so the initial field read as pointless. Added a compact preview chip (emoji + `formatProfileName(name, initial)`, "Your name" placeholder while empty) at the top of the form so the choices are concrete as you type. Reuses the existing formatter; no logic change. Auth-gated so verified via tsc + tests, not a live preview.
- **Flagged, not changed:** the "Step 1 of 2" header over-promises for the auto-joining-invite path (that lands straight on /today with no visible step 2). Left as-is since the downstream path depends on group settings we can't predict at onboarding time — a conditional label could be wrong more often than right.

### 2026-07-08 (feature: guest rep import on signup)

- **Guests can carry their reps into a real account.** Migration `0039` `import_guest_reps(group_id, entries jsonb)` — inserts the device's guest reps into the member's group on their original local days (honest timeline; counts toward history/streak/XP). One-time self-import, so it bypasses the group backdate policy + oversize check (own honest reps); clamped to the last 60 days, ≤1000/entry; respects `can_group_write`. `GuestImportPrompt` card on Today offers "Add my reps to <Group>?" when this device has guest data and the user just joined; declines are remembered (`isGuestImportDismissed`). Guest banner reworded from "they'll disappear" to "bring these reps with you". Late-joiner leaderboard fairness already covered by since-you-joined + official-period rules.

### 2026-07-08 (feature: guest mode)

- **No-account guest playground** at public route `/guest` (linked from the login screen: "Just want a play? Try it as a guest →"). Self-contained page (not the auth-gated `TodayPage`) reusing `CircularLogger` + `BankPushupsButton`; reps stored in `localStorage` via `src/lib/guestLog.ts` (no Supabase). Persistent accent banner explains data is device-only and can be lost, with "Create free account" / "Sign in" CTAs; today total + set list with delete. Pure day-grouping logic unit-tested; verified live end-to-end in the preview (bank → localStorage → total, survives reload) since the route needs no auth.
- **Conversion nudge (design-loop):** crossing 25/50/100/250/500/1000 guest reps fires a one-time celebratory toast ("💪 N reps as a guest — save them before you lose them") with a **Sign up** action — catches the sunk-cost moment when a guest is most likely to convert. `milestoneToCelebrate` is pure + unit-tested (handles big jumps and already-shown milestones); shown-state persisted so it never repeats. Verified live.

### 2026-07-08 (UX-audit loop — keyboard focus + touch targets)

- **Focus-visible rings on the app's most-used interactive elements**, which were relying on inconsistent browser-default outlines (or nothing). Swept: `SegmentedControl` (the biggest win — Board range/metric, Log side toggle, progress selectors all run through it), `SettingsLinkRow` (every Settings nav row), `Toast` action + dismiss buttons, the Group hub cards (`role="button"` Mates/Challenges/Badges), Board `MyProgressPanel` activity chips, `RepCalendar` day cells + month nav, and the feed density toggle. Standard is `focus-visible:ring-2 ring-accent/60` — `ring-inset` for dense grids/tabs (so the ring can't be clipped by neighbours) and `ring-offset-2` for the standalone cards. Verified on `/dev/preview`: keyboard focus on a segment yields a computed `rgba(242,93,36,0.6) 0 0 0 2px inset` box-shadow.
- **Touch targets bumped to 44px** where they were under: RepCalendar month-nav chevrons (`min-h-9`→`min-h-11`) and the feed density toggle (`min-h-8`→`min-h-9` + hit-area padding). Also gave the toast dismiss "×" a real 32px hit box and an `aria-label` to the density toggle.
- Follow-up worth doing later: extract the repeated focus-ring string into a shared constant (the gaps existed because there's no single source) and finish the remaining sub-44px buttons in Settings sub-cards.

### 2026-07-08 (feature: "Both" for sided custom activities)

- **Sided custom activities can now log both sides at once** (user-reported gap — you could only do Left *or* Right per set). The Log toggle is now **Left / Both / Right**; picking **Both** and banking writes one `left` and one `right` entry (`useBankCustomActivity` now returns the row(s)), so per-side totals and the day card's "Left N / Right N" stay exact — no schema change (`side` stays the `left`/`right` enum; 'both' is a UI-level `SideChoice` convenience). Undo removes both entries; single-side banks still auto-flip to the other side, Both stays put.
- **Not visually verified in a live authed session** (the sided flow needs a signed-in user + a custom activity; the dev-preview logger can't reach it). Rests on tsc + 423 tests + the straightforward two-insert path.

### 2026-07-08 (UX-audit loop — reported layout fixes)

- **Sided custom activities overflowed the Log screen** (user-reported): the Left/Right toggle added a row that pushed the "Bank …" button behind the bottom nav on standard phones. Recovered vertical rhythm on the Log column — and on user follow-up ("get rid of some spacing so it fits better") tightened further to ~84px total from the original: `pt-8`→`pt-4`, column `py-4`→`py-1`, switcher `mb-4`→`mb-2`, the three control gaps `mt-4`→`mt-2`, and the `+10` utility button to a more compact `min-h-11 px-8` (still a 44px touch target). No element removed. Belt-and-suspenders: `RING_CONTAINER_SIZE` is now `min(72vw, 336px, calc(100dvh - 25rem))` so on genuinely short phones the ring shrinks instead of clipping the CTA. Verified the calc engages only under ~660px height (240px ring at 360×640; unchanged 281px at ≥740px), so normal phones keep the full hero. (The side toggle later grew to Left/Both/Right in a separate change, which the tightening comfortably absorbs.)
- **Settings → Profile had a dead gap** (user-reported): the "Profile" label sat in a header row whose height was set by a 36px Edit button pinned with `items-start`, leaving empty space above the avatar/name. Moved Edit into the avatar/name row (`justify-between`, vertically centred) where it belongs — the button now aligns with the identity it edits; added `truncate`/`min-w-0` so long names/timezones don't push it off.

### 2026-07-08 (feature: denser feed layout)

- **Compact / Comfortable feed toggle** on the Group feed (persisted to `localStorage`). Dense mode tightens row padding, shrinks the avatar, and folds the timestamp under the rep count so more entries fit per screen; comfortable is the default. Reactions unchanged.

### 2026-07-08 (feature: late-joiner fairness — since-you-joined)

- **"Since you joined" Board view.** A recent joiner (joined after the current month started) gets a toggle that re-scores the whole group over the window they've actually been present, via a period-override on `useLeaderboard` + `useMyJoinDate`. On week/month views they also get a note: "you joined mid-week, official weekly scoring counts from `<next Monday>`" (`officialScoringStartsAt`).
- **Note on scope:** the Board's existing week/month leaderboards already *are* the official weekly/monthly scoring, so no duplicate "competition" rows were created; late-joiner fairness is delivered as the since-you-joined view + the official-start note rather than a parallel auto-competition system.

### 2026-07-08 (UX-audit loop — destructive-action safety)

- **"Block" on a mate was a one-tap, permanent footgun.** Blocking severs the connection forever ("they can never reconnect") but was a plain muted-grey text button — identical weight to "Remove mate", no confirm, danger colour only on hover (invisible on touch). Reworked both destructive footer actions into a single mutually-exclusive arm-to-confirm state (`pendingDestructive`) with a 4s auto-disarm; the armed button turns solid `text-danger` with "Tap again to block/remove", a `role="status"` line spells out that blocking is permanent, and both got focus rings. Matches the app's existing archive arm-to-confirm pattern.
- **Moderation "Reject"/"Decline" looked like neutral actions.** Both were `variant="ghost"` sitting next to a primary Approve, so a consequential action (rejected entries stop counting; declined applicants must re-apply) read as low-stakes → both now `variant="danger"` (outlined red-tinted, distinguished by fill/border not colour alone).
- **Entry moderation loading was un-scoped:** a shared `reviewMutation.isPending` spun *every* pending row's Approve *and* Reject at once, hiding which action was in flight. Now derives `processing = reviewMutation.variables` so only the acted button spins and the rest of the queue is disabled (GroupAdminSettings already did this per-request).

### 2026-07-08 (feature: admin banter badges)

- **Banter badges** live (no migration — `custom_badges` / `user_custom_badges` tables + admin-write RLS already existed in 0004). `useCustomBadges` hook (create / delete / award / revoke / read); `CustomBadgeAdmin` card in Group admin lets owners/admins make named+emoji badges and award them to members; awarded badges show in a "Group badges" section on Achievements.

### 2026-07-08 (feature: overage caps)

- **Calm overage confirmation** on the Log page (migration `0038` adds `is_override` + `mark_entry_override`). Banking that would cross a health-guard cap opens a non-medical "that's a big day 💪" sheet; confirming logs it and records the override on the entry, cancelling keeps the ring. Never hard-blocks (locked rule). Cap derived from the plan's daily volume (`overageCap.ts`, floored at 150 so it never nags in normal training); skipped for deliberate max-set check-ins. Pure caps logic unit-tested.

### 2026-07-08 (feature: goal streak)

- **Goal streak** surfaced on Achievements (migration `0037`): `compute_goal_streak_days` + `my_streaks` RPCs. "Goal" = `notification_preferences.daily_target` (same daily goal the reminders use, so streak and reminders agree). Rest days / freezes / injury windows protected; today under goal doesn't break it. Shows as a line in the streak-freeze card when ≥ 1 day.

### 2026-07-08 (feature: leaderboard metrics)

- **Biggest set** and **most improved** leaderboard metrics (migration `0036`, `leaderboard_metric` RPC — same row shape as `leaderboard_total`, `total` column carries the metric value; most-improved = this period minus the previous equal-length window, can be negative). Board shows a metric SegmentedControl on week/month (hidden on Day, which keeps its own goal progress). Row shows signed `+N vs last` for most-improved, `N in a set` for biggest set. Bank invalidation broadened to the `['leaderboard']` prefix so all metric variants refetch; optimistic delta still only touches the total board.
- **Goal-completion as a period metric deferred** — needs each member's historical daily target resolved per day (plan-engine, ambiguous server-side). The Day board already shows each member's % of their daily target.

### 2026-07-08 (feature: injury / sub-out)

- **Full injury/sub-out feature** (migration `0035`). `injury_episodes` (modeled as episodes with since/ended so a streak stays protected even after return); RPCs `set_availability` / `end_injury` / `resume_full_plan` / `group_availability_statuses` / `my_injury_status`, all SECURITY DEFINER. Going injured/sub-out pauses reminders (reuses `injury_paused`), sets `plan_status='paused_injury'`, and is group-visible; returning drops into `ramp_back` (targets eased ~30% in `useTrainingPlan`, user taps "Resume full" to exit — no cron). `compute_active_streak_days` extended to skip injury-window days.
- **UI:** `AvailabilitySettings` card in Settings → Training (owns injury now — removed the redundant reminder-card "Injury pause" checkbox that could desync); 🤕/⏸️ chips on the Group member list via `group_availability_statuses`; gentle recurring banner on Today. Plan progression sync gated off while `paused_injury`/`ramp_back`.

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
