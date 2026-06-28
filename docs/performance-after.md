# Performance report — after optimisation

## Bundle sizes

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Main app chunk (gzip) | 101.20 kB (`index-B__fuLJI.js`) | 26.07 kB (`index-D6SgWkjy.js`) | **−74%** |
| Today route chunk | 5.95 kB separate lazy chunk | Eager in main chunk | No Suspense on first `/today` visit |
| Total JS+CSS (gzip) | ~127 kB (main + Today + CSS) | 152.66 kB (all chunks, better caching) | Vendor split for long-term cache |
| Vendor React (gzip) | in main | 44.64 kB | Cached independently |
| Vendor Supabase (gzip) | in main | 27.34 kB | Cached independently |

Run `npm run build:stats` anytime for current numbers.

## Biggest improvements

1. **Today drag isolation** — `useCircularCounter` moved inside `CircularLogger`. Drag updates no longer re-render `DayProgressCard`, entries list, billing banner, or bank button on every frame.
2. **Bank/undo network** — Removed success-path `onSettled` refetches. Bank now sends 1 RPC; today, leaderboard, and activity caches update optimistically.
3. **Shared tab layout** — `TabLayout` keeps header and bottom nav mounted across Today, Leaderboard, Activity, and Group. Tab chunks prefetch on layout mount and nav click.
4. **Query scoping** — Narrow invalidations, billing queries gated when Stripe disabled, Group members use 30s staleTime, entries fetch uses session user id (no extra `auth.getUser()`).
5. **Bundle split** — `manualChunks` for React, Query, Supabase, date-fns. Removed unused `react-hook-form` and `zod`. Lazy `PushNotificationPrompt`.

## Remaining bottlenecks

- **Activity feed SQL** — `activity_feed` RPC still uses per-row reaction count subqueries (server-side). Deferred; client already uses one RPC.
- **Auth sign-in** — Profile/membership still fetched via multiple paths on cold OAuth callback. Partially mitigated by React Query cache reuse on warm sessions.
- **First tab visit** — Leaderboard/Activity/Group still need one lazy chunk load on first visit (prefetch reduces perceived delay).
- **Lighthouse** — Not run in CI here; recommend Rhys spot-check on deployed site with Slow 4G.

## Network targets (expected)

| Event | Before | After (expected) |
|-------|--------|-------------------|
| Today load (warm) | 2–6 queries | 2 (+ billing only if enabled) |
| Bank push-ups | RPC + 2 refetches | 1 RPC |
| Tab switch (within 30s) | Possible remount + refetch | 0 if cache fresh |
| Group revisit | Always refetch members | 0 if cache fresh |

## Tests run

```text
npm test                    — 118 passed
npm run test:integration    — 55 passed (RLS + billing)
npm run build               — success
npm run test:e2e            — 21 passed
```

## Rhys phone checklist (390×844)

1. Drag 20 reps — ring should feel smooth; no loading flicker elsewhere on screen.
2. Bank — total and entries update instantly; toast Undo works.
3. Switch to Leaderboard — your total should reflect the bank without a full-screen spinner.
4. Tab cycle Today → Leaderboard → Activity → Group → Today — nav/header should not flash; revisit tabs without spinners.
5. Group — second visit should show members immediately.
