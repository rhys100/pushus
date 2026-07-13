# Production readiness plan — 2026-07-13

App ships tomorrow. This is the prioritized fix list from a full audit of the push
notification system, edge functions, new features (mates / 1v1 battles / reactions /
group challenges), and general production readiness. Work top to bottom; P0 must land
and be **deployed** tonight. Each item has file:line anchors and acceptance criteria.

Symptoms this explains: the red "Failed to send a request to the Edge Function" banner
on the Mates screen (nudge buttons), and reactions to a mate's log never notifying them.

---

## P0 — Ship blockers

### P0.1 Add CORS to `send-nudge` and `send-social` (root cause of both reported bugs)

Neither function handles the browser preflight or sets CORS headers on any response:

- `supabase/functions/send-nudge/index.ts:71-74` — `Deno.serve` immediately 405s
  anything that isn't POST; its local `jsonResponse` (`:22-27`) sets only `Content-Type`.
- `supabase/functions/send-social/index.ts:169-172` — identical defect (`jsonResponse` at `:39-44`).

The app origin (`www.pushus.app`) and functions origin (`<ref>.supabase.co`) are always
cross-origin, and `supabase.functions.invoke` sends `Authorization` + `apikey` +
`x-client-info` + `Content-Type: application/json`, which forces an OPTIONS preflight.
The preflight gets a 405 with no `Access-Control-Allow-*` headers → the browser blocks
the call → `FunctionsFetchError: "Failed to send a request to the Edge Function"`.

Downstream effects:
- Nudges (Push/Cheer/Stir) throw; `MatesPage.tsx:106-107` toasts the raw message — that
  is the red banner in the screenshot.
- All five `notifySocial` call paths fail **silently** (see P0.3): reactions
  (`src/hooks/useActivityFeed.ts:196`), mate request (`src/hooks/useMates.ts:135`),
  mate accepted (`:158`), challenge invite (`:248`), group challenge
  (`src/hooks/useChallenges.ts:193`). This is why the mate got no reaction notification.

**Fix** (mirror the pattern already used in `create-checkout-session/index.ts:10-12`):
1. In both functions, import `corsHeaders` from `../_shared/supabase.ts`.
2. Add as the first branch: `if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })`.
3. Merge `corsHeaders()` into every response the functions emit (fold it into their local
   `jsonResponse`, including the 405/401/400/500 paths).

### P0.2 Add CORS headers to billing function POST responses

`create-checkout-session` and `create-customer-portal-session` handle OPTIONS but their
real responses go through the shared `jsonResponse` (`supabase/functions/_shared/supabase.ts:32-37`),
which omits `Access-Control-Allow-Origin`. The browser blocks reading the response →
checkout/portal likely fail in production with the same generic error.

**Fix:** merge `corsHeaders()` into the shared `jsonResponse` in `_shared/supabase.ts`.
(That also covers P0.1 step 3 if the two social functions switch to the shared helper —
preferred, they currently duplicate it locally.) `stripe-webhook` and
`send-push-reminders` are server-to-server; extra CORS headers there are harmless.

### P0.3 Make `notifySocial` failures observable

`src/lib/notifications/notifySocial.ts:29-35` fire-and-forgets and swallows everything.
Worse, `supabase.functions.invoke` does **not reject** on HTTP errors — it resolves with
`{ error }` — so the `.catch(() => {})` doesn't even see most failures and nobody does.

**Fix:** keep it non-blocking (a push hiccup must never break the action), but inspect
the resolved `{ error }` and `console.warn('[notifySocial]', type, error)` on failure
(both the resolved error and the rejection path). That's enough to diagnose in the field.

### P0.4 Stop showing raw supabase-js error strings to users

- `src/lib/errors.ts:20-33` — `getErrorMessage` passes through any non-"opaque" message,
  so `"Failed to send a request to the Edge Function"` reaches the toast verbatim.
  **Fix:** map `FunctionsFetchError` / `FunctionsHttpError` messages ("Failed to send a
  request to the Edge Function", "Edge Function returned a non-2xx status code") to
  friendly copy, e.g. "Couldn't reach the server. Check your connection and try again."
- `src/hooks/useBilling.ts:83,97` — both billing invokes `throw error` raw, discarding
  the server's useful `{ error }` body ("Group owner required", etc.).
  **Fix:** wrap with `messageFromFunctionsInvokeError` exactly as `useMates.ts:222-229`
  already does for nudges. `BillingPage.tsx:91,105` then shows the right message for free.

### P0.5 Deploy + verify (the code fix alone does nothing)

1. `npx supabase functions deploy send-social send-nudge create-checkout-session create-customer-portal-session`
   (config.toml already pins verify_jwt correctly per function — `supabase/config.toml:71-81`).
2. Verify from the **deployed** app with two accounts:
   - React to a mate's log → mate's device gets the push (recipient needs
     `push_enabled=true` and social toggle on, and no reaction push in the last 30 min —
     the cooldown in `send-social/index.ts:31-37` will otherwise eat the test; clear
     `social_push_log` rows between attempts).
   - Tap Push them / Cheer / Stir up → no red banner; second nudge same day → friendly
     once-per-day message (proves the server's 400 body now reaches the toast).
   - Start checkout → Stripe page opens; open customer portal → portal opens.
   - Create a group challenge → other member gets the push.

---

## P1 — Correctness bugs worth fixing before launch

### P1.1 Challenge cards display the exclusive end date (off-by-one)

`ends_at` is stored as an exclusive boundary (`src/lib/challenges.ts:100-104`), but both
display sites render it raw: `src/pages/ChallengeDetailPage.tsx:199-202` and
`src/pages/ChallengesPage.tsx:42-45`. A one-day challenge on 13 Jul renders
"13 Jul – 14 Jul"; a 7-day shows an 8-day span. Scoring is correct
(`challengeDateRange` subtracts 1ms, `challenges.ts:129-133`) so the UI contradicts the
scored window. **Fix:** render the inclusive last day (reuse `challengeDateRange().endIso`)
and format in the group timezone, not the viewer's browser tz.

### P1.2 1v1 battle scoring windows on `logged_at` instead of `logged_for`

`list_mate_challenges` sums `pushup_entries` by insert timestamp
(`supabase/migrations/0032_mates.sql:644-657`). With back-dated logging (migration 0041)
a user can log reps "for yesterday" during a battle and have them count, while reps done
in-window but banked after the end don't. Group challenges do it right (`logged_for`,
`src/hooks/useChallenges.ts:107-114`). **Fix:** new migration replacing the RPC to window
on `logged_for` over the battle's inclusive date range, consistent with group scoring.

### P1.3 "You vs mate" tiles compare windows in two different timezones

`get_mate_stats` anchors every window on the **target** user's timezone
(`supabase/migrations/0032_mates.sql:435-451`), and `MatesPage.tsx:71-72` calls it once
per side — so "TODAY 31 vs 10" can compare your Sydney today against their London today.
**Fix:** add a tz parameter (viewer's tz for both sides), or anchor both on the viewer's
profile tz inside one RPC call. Same-tz mates are unaffected, so this is P1 not P0.

### P1.4 Push subscriptions never self-heal after a 410 disable

When a push endpoint returns 410/404 the functions set `enabled=false`
(`send-social/index.ts:156-158` etc.). The browser subscription still exists, Settings
still shows push on, and every future push (reminders + social) is dropped until the user
manually toggles. `ensurePushSubscriptionForUser` (`src/lib/notifications/registerPush.ts:210`)
is only called from the Settings toggle (`useNotificationPreferences.ts:217`).
**Fix:** on app boot (post-auth, production only), if `Notification.permission === 'granted'`
and prefs say `push_enabled`, call `ensurePushSubscriptionForUser` to re-upsert the
subscription with `enabled=true`.

### P1.5 No notification when a 1v1 challenge is accepted

`useRespondMateChallenge` (`src/hooks/useMates.ts:253-265`) never notifies the
challenger, so battles start silently. **Fix:** add a `challenge_accepted` type to
`send-social` (server-verifies an accepted `mate_challenges` row where
`challenger_id = target`, `opponent_id = caller`), and call `notifySocial` on accept.
Decline can stay silent by design.

---

## P2 — Post-launch improvements (do not block tomorrow)

1. **Reaction/social cooldown too coarse** — `social_push_log` is keyed on
   `(user_id, kind)` only (`send-social/index.ts:105-114`), so a challenge push for
   group A suppresses group B's within the hour, and one reaction push mutes all
   reactors for 30 min. Add a context discriminator column (entry/competition id).
2. **Nudge reports success when nothing was pushed** — `send-nudge` returns
   `{recorded:true, pushed:0}` (`send-nudge/index.ts:148-150`); sender sees "sent".
   Surface "logged in-app; their push is off/quiet hours" in the toast.
3. **Reaction toggle 23505 race** — `useActivityFeed.ts:154-199` select-then-insert;
   treat unique-violation 23505 as success like `useChallenges.ts:189` does.
4. **Battle end not reactive** — `MatesPage.tsx:426-440` captures `Date.now()` per
   render; a live battle won't flip to "Recent results" until refetch. Minor.
5. **Back-dated custom challenge mis-scores the creator** — creator's
   `official_scoring_starts_at` defaults to now (`useChallenges.ts:184-190`); set it to
   the challenge start when creating a past-dated custom challenge.
6. **Nudges vs social toggle inconsistency** — send-nudge ignores `social_push_enabled`
   but gates on active hours; send-social is the opposite. Decide and document (the
   Settings copy currently, correctly, doesn't mention nudges).
7. **Feed-slice edge case** — `GroupFeedPanel.tsx:364-376`: when `targetItem` is
   undefined the reaction still writes but never notifies; guard or fetch the entry owner.
8. **z-index collision** — `NoseTapMode.tsx:349` (z-50) ties with
   `BottomDockPrompt.tsx:14` (z-50); the install dock can bleed over nose-tap mode.
9. **Trial length single source of truth** — `create-checkout-session/index.ts:129`
   hardcodes 45; client reads `VITE_TRIAL_DAYS` (`src/lib/billing.ts:8`).
10. **Tests** — biggest gaps: no RLS tests for the four mates tables (writes are
    RPC-only SECURITY DEFINER, so deferred-acceptable), no Stripe webhook test, no e2e
    for mates/challenges/billing. Add mates RLS suite first.
11. **Tighten CORS origin** — `_shared/supabase.ts:41` uses `*`; restrict to the app
    origins once things are stable.

## Ops checklist (Rhys, not code)

- [ ] Rotate `CRON_SECRET`: it sits in plaintext in `.env.push-reminders` inside a
      Dropbox-synced folder (not in git — verified). Update the Supabase secret + the
      pg_cron Vault value together.
- [ ] Delete the ~27 `vite.config.ts.timestamp-*.mjs` / `vitest.config.ts.timestamp-*.mjs`
      junk files in the repo root (gitignored; safe to `rm`).
- [ ] Confirm pg_cron reminder schedule is live and the GitHub Actions fallback is
      disabled (docs/push-reminders-go-live.md).
- [ ] After P0 deploy, run the two-account verification in P0.5 on real phones
      (iOS home-screen PWA + Android).

## Verified healthy (audited — don't re-spend time here)

- RLS enabled on every new table; mates writes RPC-only with `auth.uid()` checks;
  self-reactions blocked at DB; `social_push_log` service-role only.
- Stripe webhook: signature verified, idempotent via unique `billing_events`, 500-on-error
  for retries; entitlement enforced server-side.
- No secrets in git history or `src/`; service-role key only in edge functions.
- iOS: `Notification`/`PushManager` guarded before property access; no non-PWA crash path.
- SW is push-only (no asset caching) with layered boot recovery for the poisoned-cache issue.
- Settings field names match edge-function readers exactly (`social_push_enabled` etc.).
- Payload shapes match between all invoke call sites and functions.
- Loading/error/empty states present on Mates, Challenges, Leaderboard, Today.
- App copy consistently "PushUS"; no stray console.log/TODO in src.
