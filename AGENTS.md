# AGENTS.md — working guide for AI/dev agents on PushUS

Practical, repo-specific orientation. Read this before making changes. For locked
product rules see [docs/product-decisions.md](docs/product-decisions.md); for the
running history see [docs/dev-log.md](docs/dev-log.md) and [CHANGELOG.md](CHANGELOG.md).

## What the app is

PushUS — a privacy-first, self-hostable PWA for banking push-ups with your mates.
Mobile-first, dark-first (light theme supported), installable. Core loop:

1. **Log** (`/today`) — dial reps on the circular logger (drag the ring, `+10`, or
   nose-tap mode), then **Bank**. Optional custom activities (e.g. calf raises) with
   Left/Both/Right sides. A training plan engine sets daily targets.
2. **Board** (`/leaderboard`) — day/week/month leaderboards, personal progress chart,
   metrics (total / biggest set / most improved).
3. **Feed** (`/activity`) — group activity with reactions.
4. **Group** (`/group`) — members, invites, plus Mates (1v1 battles, nudges),
   Challenges, and Achievements (XP, streaks, badges).
5. **Settings** (`/settings`) — profile, appearance, training plan, push reminders.

Guest mode lets a signed-out user try the logger; reps stored in the browser and
imported on signup.

## Stack

- **React 18.3** + **TypeScript** (strict, `tsc -b`) + **Vite 6**.
- **Tailwind 3.4** only — no CSS-in-JS, no component library. Design tokens are CSS
  variables (see Styling below).
- **TanStack Query 5** for all server state; **react-router 6**.
- **Supabase** (Postgres + Auth + Edge Functions) is the backend. RLS-enforced;
  writes go through `SECURITY DEFINER` RPCs.
- `date-fns` / `date-fns-tz` for time (timezone-correct day boundaries matter a lot).
- No heavy deps. Do **not** add a chart lib, animation lib, or UI kit — the app
  hand-rolls SVG charts, a CSS motion system, and its own primitives.

## Commands

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev server | `npm run dev` (Vite; honours `PORT`) |
| Typecheck | `npx tsc -b` |
| Lint | `npm run lint` (eslint) |
| Unit tests | `npm test` (vitest) |
| RLS tests | `npm run test:rls` |
| Billing tests | `npm run test:billing` |
| E2E | `npm run test:e2e` (Playwright) |
| Build | `npm run build` (OG + PWA asset gen → `tsc -b` → `vite build`) |
| Build + bundle stats | `npm run build:stats` |
| Version bump | `npm run version:bump` |
| Version consistency check | `npm run version:check` |

**Before committing any change, run `npx tsc -b` and `npm test`.** A Husky pre-commit
hook runs `version:check` + `check-docs-staged` and will reject the commit otherwise.

## Project structure

```
src/
  pages/           route screens (TodayPage, LeaderboardPage, GroupPage, …)
  components/
    ui/            design-system primitives (Button, Card, Badge, SegmentedControl,
                   Toast, EmptyState, Skeleton, StatCard, BottomNav, …)
    logger/        CircularLogger + banking UI (perf-sensitive; see below)
    feed/ progress/ today/ settings/ group/ training/ billing/ layout/
  hooks/           TanStack Query hooks — one per data concern (useLeaderboard, …)
  providers/       Auth → NotificationPreferences → Group context (all memoized)
  lib/             pure helpers (haptics, motion, cn, storage, training/*, *Calc)
  styles/          tokens.css (design tokens + theme) , motion.css (animations)
  types/           shared TS types (database, mates, gamification, …)
supabase/
  migrations/      append-only SQL (39+; never edit a shipped migration)
  functions/       edge fns: stripe-webhook, create-checkout/portal-session,
                   send-push-reminders, send-nudge
docs/              dev-log, product-decisions (locked rules), roadmap, specs
scripts/           version + doc gates, asset generators, integration runner
```

## Architecture decisions

- **Server state lives in TanStack Query**, never duplicated into local state. Query
  client defaults: `staleTime: 30_000`, `retry: 1` (`src/main.tsx`). Hooks own their
  keys and invalidation; banking invalidates the `['leaderboard']` prefix + day/feed.
- **Provider context values are memoized** (`useMemo`) with stable callbacks
  (`useCallback`) so consumers don't re-render on every provider tick. Preserve this.
- **Writes go through RPCs**, reads through RLS-safe selects. Don't add client-side
  mutations that bypass an RPC where one exists.
- **Timezone correctness**: day totals/streaks use the group/profile timezone, not the
  device clock. Use the existing `getGroupLocalDateString` / training-lib helpers.
- **Dev preview**: `/dev/preview` (DEV-only, no auth) renders the logger + a motion
  showcase — use it to verify animations/logger without a backend.

## Performance rules

- Prefer **CSS transforms/opacity** for animation; the motion system
  (`src/styles/motion.css`) is transform/opacity-based and honours
  `prefers-reduced-motion`. Avoid animating layout properties, and avoid new
  blur/filter/large box-shadows on frequently-repainted elements (mobile paint cost).
- Entrance animations must use `animation-fill-mode: backwards`, **not** `both` — a
  filling animation permanently overrides later `transform` styles and silently kills
  `active:scale` press feedback. Don't stack two animation classes on one element
  (they cancel); put the entrance on a wrapper.
- Memoize expensive `map/filter/reduce/sort` and `date-fns` parsing over lists; keep
  list rows in `React.memo` where they already are (e.g. `DayProgressCard`).
- `useCountUp`/rAF and the FLIP list (`useFlipList`) already `cancelAnimationFrame`
  and clean up on unmount — match that pattern; never leave a timer/rAF/subscription
  uncleaned.
- **Verifying animations**: the in-editor preview window is often occluded (rAF
  throttled, `visibilityState: hidden`), so measure via **headless Playwright against
  `/dev/preview`**, not the preview screenshot tool.
- Vite's `cacheDir` is pinned to the OS temp dir (`vite.config.ts`) because this repo
  lives in a Dropbox-synced tree that locks the dep-optimizer rename (EBUSY → 504s).
  Don't move it back.

## Styling / design system

- **Use design tokens, not bare values.** Colours come from CSS vars surfaced to
  Tailwind: `bg-bg`, `bg-surface`, `text-accent`, `text-text-primary`,
  `text-text-muted`, `border-border`, `bg-success/…`, etc. Radii use
  `rounded-[var(--radius-sm|md|lg|full)]` — do **not** use Tailwind's bare
  `rounded-md/lg` (they don't match the token scale).
- **Light + dark**: tokens are defined for `:root,[data-theme='dark']` and overridden
  under `[data-theme='light']` in `tokens.css`. Never hardcode a hex that only works
  in one theme; add/use a token. Immersive surfaces (nose-tap mode) pin themselves
  dark via nested `[data-theme='dark']`.
- **Focus + touch**: interactive elements get
  `focus-visible:ring-2 focus-visible:ring-accent/60` (`ring-inset` for dense
  grids/tabs, `ring-offset-2` for standalone cards). Touch targets ≥ 44px
  (`min-h-11`). Reuse `Button`, `SegmentedControl`, `EmptyState`, etc. rather than
  re-styling raw elements.
- **Haptics**: `src/lib/haptics.ts` (`tapHaptic`/`selectHaptic`/`successHaptic`) for
  UI; `src/lib/repHaptic.ts` for per-rep logger patterns.

## Versioning (SemVer — enforced)

Source of truth is **`package.json` `version`**. `scripts/check-version.mjs` (run in
pre-commit) requires all four to agree:

1. `package.json` version
2. `package-lock.json` version
3. the latest `## [x.y.z]` release heading in `CHANGELOG.md`
4. the `**vx.y.z**` row in `README.md`

Day-to-day work lands under the CHANGELOG **`## Unreleased`** section (which does not
need to match `package.json`). **Cutting a release** = move `Unreleased` under a new
`## [x.y.z]` heading, bump `package.json` + `package-lock.json` + add the README row +
add matching `whatsNew.ts` entries, then `version:check` must pass. Prefer
`npm run version:bump`.

After the release commit is on `main`: annotated tag `vX.Y.Z`, push the tag, then
**create a GitHub Release** (`gh release create vX.Y.Z … --latest`) with notes from
that CHANGELOG section. Do not treat the tag alone as a finished release — GitHub
Latest must match README. See `.cursor/rules/versioning.mdc`.

- **Patch** — bug fixes, polish, perf, copy, internal refactors (no user-facing
  behaviour change).
- **Minor** — new user-facing features/settings, meaningful UX or perf upgrades.
- **Major** — breaking changes, removed functionality, incompatible data/migration
  changes.

Don't invent a version; bump from the current one.

## Release notes

- **CHANGELOG.md** — meaningful, user-and-operational changes (Keep a Changelog
  format). Accumulate under `## Unreleased`.
- **docs/dev-log.md** — daily engineering notes (newest first); this is where routine
  work is recorded.
- **In-app "What's new"** — `src/lib/whatsNew.ts`. Add an entry (with the release
  version + emoji/icon) only for **major user-facing features**; returning users see a
  one-time popup. User-facing language only — no internal refactors.

## Doc gate (why your commit may be rejected)

`scripts/check-docs-staged.mjs` requires that any change touching `src/pages/`,
`src/components/`, `src/hooks/`, `supabase/migrations/`, or `supabase/functions/` is
committed **alongside** a doc update (CHANGELOG, README, dev-log, product-roadmap, or
product-decisions). So: stage a dev-log line with every feature/fix commit.

## Careful areas — don't casually change

- **`docs/product-decisions.md` locked rules** — e.g. banking never hard-blocks (the
  overage cap only warns), nose-tap mode stays dark, streak protection semantics.
  Read before touching training/streak/logging logic.
- **Migrations are append-only.** Never edit a shipped migration; add a new one.
- **RLS / RPC security** — writes must stay behind `SECURITY DEFINER` RPCs; don't relax
  a policy to make a query easier. `npm run test:rls` guards this.
- **`CircularLogger.tsx`** — hand-tuned pointer-gesture + rAF + SVG code with haptics.
  High regression risk; change deliberately and verify on `/dev/preview`.
- **Timezone logic** in `src/lib/training/*` and day-boundary helpers.
- **Billing** (`src/components/billing`, Stripe edge fns) — has its own test suite.

## Known tradeoffs / tech debt

- **Concurrent agents**: multiple agents often edit this tree at once. Commit in small,
  self-contained units; re-read a file if an edit reports "modified since read";
  `git pull --rebase` before pushing.
- The focus-ring / `min-h-11` string is repeated across components — a shared
  `FOCUS_RING` constant is a sensible future cleanup (the drift is why gaps appeared).
- `CHANGELOG Unreleased` has accumulated a large batch ahead of the next release cut;
  keep adding there until a release is deliberately cut.
- Preview-tool screenshots are unreliable in this environment (occluded window); rely
  on headless Playwright + `tsc`/tests for verification.
