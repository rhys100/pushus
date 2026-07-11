# PushUS — Pre-Production Security Audit

**Reviewer:** Senior security engineer (pre-production audit)
**Date:** 2026-07-11
**Supersedes:** the 2026-07-07 audit (which covered migrations `0001`–`0028`). This pass re-verifies every prior finding against the current code and adds coverage for everything added since — the **mates/nudges** system (`0032`), **admin entry review** (`0033`), **entry override** (`0038`), **guest rep import** (`0039`), **injury status** (`0035`), **leaderboard metrics / streaks** (`0034`,`0036`,`0037`,`0040`), and the **edit-yesterday** self-edit path (`0041`).
**Scope reviewed:** `push-ups-app` — React/Vite SPA, Supabase (Postgres + RLS + Edge Functions), Cloudflare Pages + Pages Functions, Stripe billing, web-push reminders, GitHub Actions.
**Method:** File-by-file inspection of all 41 migrations, every RLS policy, every `SECURITY DEFINER` RPC granted to `authenticated`/`anon`, all 5 Supabase Edge Functions + shared helpers, the Cloudflare Pages Functions (invite OG/preview), the frontend auth/session/routing and all XSS sinks, `public/_headers`, `_routes.json`, `vite.config.ts`, CI, and env handling. Findings are tied to specific code with `file:line`. Where I could not confirm something from the codebase it is marked **Not verified**.

---

## A. Executive summary

**Overall security rating: Moderate Risk.**

This is a genuinely well-built application from a security standpoint, and that assessment held up under the expanded surface area. The hard things are done right:

- **Row Level Security is enabled on all 40 public tables** (verified: the set of `CREATE TABLE` names equals the set of `ENABLE ROW LEVEL SECURITY` names exactly).
- **All writes go through `SECURITY DEFINER` RPCs** that re-derive the acting user from `auth.uid()` and re-check membership/role — base tables are default-deny for writes.
- **Every `SECURITY DEFINER` function pins `SET search_path`** (≈120 functions, all pinned) — no search-path hijack surface.
- **No SQL injection surface:** there is zero dynamic SQL (`EXECUTE`/`format()`) in any client-callable RPC; all inputs are typed/enum/`IN`-validated.
- **The Stripe webhook verifies the signature and is idempotent;** secrets are server-side only; **no secret is committed** (the only `eyJ…` strings in the repo are `{}`-payload placeholders).
- **The frontend has no HTML/`eval` sinks** (no `dangerouslySetInnerHTML`, no markdown renderer), React escapes all user text, open-redirect is explicitly guarded, and there is a real Content-Security-Policy.
- Dependencies are **exact-pinned with no `postinstall` scripts**.

**Is it safe for production today?** For the current **Community / private-beta** configuration (billing disabled, honour-system counts, minimal PII = email + display name): **Yes — once the four must-fix items in section C are applied**, chiefly the Cloudflare header-scope bug and the admin→owner escalation guard. For **PushUS Cloud with real Stripe billing switched on: not yet** — the billing views bypass RLS (H-1) and the webhook drops permanently-failed events (BL-3); both must land first.

**Top 5 concerns in plain English:**

1. **Billing data leaks across customers the moment billing is enabled.** A database "view" meant to show a group *its own* subscription was built without the security-invoker flag, so it skips the row rules — any signed-in user could read *every* group's plan, trial and renewal dates. Harmless today (no billing rows exist in beta) but a serious cross-customer leak on Cloud launch day.
2. **A group admin can silently promote themselves to owner and take the group over.** The database lets an admin edit the group's `owner_id` (and membership roles) with no guard, so an admin can seize ownership — and, on Cloud, the paid subscription.
3. **Your security headers only protect the homepage, not the app.** The Cloudflare rule is written for `/` (the root URL only), so `/login`, `/today`, `/join/<code>` are served with *no* clickjacking protection and *no* CSP. HSTS is missing entirely.
4. **A member can fabricate unlimited push-ups.** The "import your guest reps" feature is meant to run once but isn't limited — it can be called repeatedly to inject thousands of backdated reps, inflating leaderboards, XP and badges, and it bypasses the group's own anti-cheat review.
5. **A live cron secret sits in plaintext inside a Dropbox-synced folder** (`.env.push-reminders`). It's correctly kept out of git, but Dropbox sync/share is its own leak channel; the secret lets anyone spam every user's push notifications.

**Highest-priority fixes:** (1) `security_invoker = true` on the billing views; (2) a trigger blocking `role`/`owner_id` tampering; (3) `_headers` `/` → `/*` + add HSTS; (4) make `import_guest_reps` one-time + capped; (5) rotate the cron secret and move it out of Dropbox.

**Needs specialist review:** the Stripe billing go-live (view fix + webhook replay/idempotency/failed-retry test in Stripe test mode) and a one-time Supabase Edge Function deployment-config check (`verify_jwt` per function — not expressible in the repo, see CFG-1).

---

## B. Risk table

| # | Severity | Area | Issue | Evidence | Exploit scenario | Recommended fix | Files |
|---|----------|------|-------|----------|------------------|-----------------|-------|
| **H-1** | **High** (latent until billing on) | DB / multi-tenant | Owner-only billing views omit `security_invoker`, so on PG15 they run as the view owner and **bypass** the owner-only RLS on the base tables | `CREATE VIEW group_subscriptions_owner` / `group_availability` with no `security_invoker` (grep of all migrations → 0 hits); base-table RLS is owner-only | Any authenticated user runs `select * from group_subscriptions_owner` and reads **every** group's plan, trial/period dates, cancellation state | `ALTER VIEW … SET (security_invoker = true)` on both views (and `deployment_settings_public` for consistency) | `supabase/migrations/0003_billing.sql:428,444`; `0008_private_beta.sql:12` |
| **P-1** | **Medium** (High on Cloud) | AuthZ / priv-esc | An admin can `UPDATE groups.owner_id` to themselves (the guard trigger only covers `billing_status`/`checkout_started_at`) and/or set their own `group_members.role='owner'`; no column guard | `groups_update_owner_admin` (`0002:1137`), `group_members_update_admin` (`0007:14`), guard trigger `0019:8-39` covers billing cols only; `is_group_admin`=role∈(admin,owner) `0002:30` | A group admin reassigns ownership to themselves → deletes the group, or on Cloud cancels/hijacks the Stripe subscription and evicts the real owner | `BEFORE UPDATE` triggers blocking non-owner changes to `group_members.role` and `groups.owner_id` | `0002_rls_core.sql:1137`; `0007_rls_member_list.sql:14`; `0019_security_hardening.sql:8` |
| **HD-1** | **Medium** | Headers / infra | Security headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) are scoped to `/` only; every deep-linked route gets none. HSTS absent entirely | `public/_headers:4` rule is `/` not `/*`; `_routes.json` routes `/*` to the app | Clickjacking of `/login`,`/join/<code>`; no CSP backstop on the pages that render invite/user data; no HSTS downgrade protection | Change `/` → `/*`; add `Strict-Transport-Security` | `public/_headers:4,10` |
| **BL-1** | **Medium** | Business logic / fraud | `import_guest_reps` is repeatable (no one-time guard), writes `review_status='none'` unconditionally (bypasses the group's oversize `block`/`admin_review` policy and backdate rules), and has no array-length cap | `0039_guest_import.sql:9-53` — `review_status` hard-coded `'none'` (`:45`), count clamped only `LEAST(GREATEST(e.count,1),1000)` (`:36`), no idempotency | A member POSTs `import_guest_reps` with an array of `{count:1000, day:<each of 60 days>}`, repeated indefinitely → arbitrary XP, leaderboard totals and achievements, even in a group that set `block`/`admin_review` | One-time guard + cap array length + route counts through `resolve_oversize_review_status` | `supabase/migrations/0039_guest_import.sql` |
| **IV-1** | **Medium** | Access / abuse | Invite code = 8 hex chars (`0001:103`), unlimited-use, never expires, checkable anonymously with no rate limit; a valid code **auto-joins as `active`** and **bypasses the private-beta allowlist** | `generate_invite_code()` `0001:103`; auto-`active` + beta bypass `0016:18-26,52-61`; anon grants on `is_valid_invite_code`/`get_invite_group_preview` `0008:448`,`0014:76` | Guess/scrape a code → anonymous group-name oracle → any signed-in user instantly joins + skips the beta gate; a leaked link is usable by anyone forever | Longer random codes; enforce the already-present `default_invite_limit`/`invite_slots_override`; expiry; rate-limit the anon RPCs | `0001_core.sql:98`; `0016_invite_auto_join.sql`; `0008`,`0014` |
| **BL-2** | **Medium** | Business logic / integrity | No server-side per-entry cap under the default `warn` oversize policy — a single `bank_pushups` call may set any `int` count and it counts immediately | `bank_pushups` `0002:620+`; `resolve_oversize_review_status` returns `'none'` for default `warn` (`0002:241`, default `0001:167`) | A user bank_pushups with `count = 2,000,000,000` and instantly tops every leaderboard / XP total in a default group | Add a hard server-side sanity ceiling (e.g. reject `count > 5000`) independent of the warn/override UX | `0002_rls_core.sql`; `0001_core.sql` |
| **BL-3** | **Medium** | Billing robustness | The Stripe webhook treats *any* previously-seen `event.id` as a duplicate and returns `received:true` — including events it earlier recorded as `pending`/`failed` — so a transient processing failure permanently drops the event | `stripe-webhook/index.ts:392-396` (`recordBillingEvent` returns `false` on `23505` → short-circuits), failure path `:401-405` sets `failed` then relies on Stripe retry | Stripe API timeout during `subscriptions.retrieve` → event marked `failed`; Stripe retries → seen as duplicate → never reprocessed → group's billing state goes stale (e.g. keeps access after cancel) | On duplicate, look up `processing_status`; reprocess if `pending`/`failed` instead of returning early | `supabase/functions/stripe-webhook/index.ts` |
| **S-1** | **Medium** | Secrets | Live `CRON_SECRET` (+ project ref, VAPID) stored plaintext in `.env.push-reminders` inside a **Dropbox-synced** working directory | file present at repo root under `…/Dropbox/…`; correctly gitignored (`.gitignore`), but Dropbox is a separate exposure channel | Dropbox sync/share leak → attacker POSTs `send-push-reminders` repeatedly, spamming every user's notifications | Rotate the secret; keep it only in GitHub Actions + Supabase secrets, never in a synced folder | `.env.push-reminders` |
| **RL-1** | **Medium** | Rate limiting | No app-level rate limiting on magic-link requests, the anonymous invite RPCs, or the edge functions; the cron-secret compare is not constant-time | no limiter anywhere; `send-push-reminders/index.ts:244` uses `!==` on the secret | Invite-code enumeration, magic-link email bombing, RPC hammering; relies on unconfigured/unverified Supabase platform limits | Configure Supabase Auth rate limits; add a limiter / Turnstile on anon entry points; constant-time compare the cron secret | `supabase/functions/*`; anon RPCs |
| **REV-1** | **Low** | Business logic | `review_entry` gates on `is_group_admin` but never checks `entry.user_id <> auth.uid()`, so an admin can approve their *own* oversize-flagged entry | `0033_entry_review_admin.sql:50` (admin check only) | An admin banks an oversize entry that lands `pending`, then self-approves it — admins are exempt from their own anti-cheat review (audit-logged, so traceable) | Add `AND v_entry.user_id <> auth.uid()` (or route self-flagged entries to another admin) | `0033_entry_review_admin.sql` |
| **MATE-1** | **Low** | Business logic / consent | `block_mate`'s `ON CONFLICT … DO UPDATE SET requester_id = caller` lets the *blocked* party seize the blocker slot, then `unblock_mate` themselves | `0032_mates.sql` `block_mate` (~`:263-269`), `unblock_mate` (~`:283-286`) | A blocks B → B calls `block_mate(A)` (overwrites requester=B) → B calls `unblock_mate` → block gone, B can re-request | Don't overwrite `requester_id` on conflict when an existing `blocked` row is owned by the other party | `0032_mates.sql` |
| **DEF-1** | **Low** (correctness) | Business logic | `update_pushup_entry` (0041 self-edit path) compares `review_status` against `'pending_review'`, which is **not** a valid `entry_review_status` label — the guard is dead and the member edit path likely throws a raw enum error | `0041_edit_yesterday.sql:64`; enum `('none','pending','approved','rejected')` `0001:58-63` | Fails closed (no bypass) but the intended "can't self-edit around a moderation hold" guard does nothing, and the headline edit-yesterday feature errors for non-admin members | `'pending_review'` → `'pending'` | `0041_edit_yesterday.sql:64` |
| **SW-1** | **Low** | Frontend / redirect | Service-worker `notificationclick` accepts a protocol-relative `//host` URL (`startsWith('/')` branch) and hands it to `openWindow` | `public/sw.js:81,67` | A crafted push payload with `data.url="//evil.com"` opens an arbitrary origin on tap — but payloads are server-only (need `VAPID_PRIVATE_KEY`) | Also reject `rawUrl.startsWith('//')` (align with `postAuthNavigation.ts:56`) | `public/sw.js` |
| **CSP-1** | **Low** | XSS hardening | CSP allows `script-src 'unsafe-inline'` (needed for the injected version-bootstrap script) | `public/_headers:10`; inline script injected in `vite.config.ts:28,36` | Weakens CSP as an XSS backstop (no active XSS sink exists today) | Move the bootstrap to a hashed/nonce'd script and drop `'unsafe-inline'` | `public/_headers`; `vite.config.ts` |
| **CORS-1** | **Low** | Edge functions | `Access-Control-Allow-Origin: *` on checkout/portal/nudge functions | `supabase/functions/_shared/supabase.ts:39-44` | Any origin can call with a stolen bearer token (token still required; not cookie-based, so no CSRF) | Restrict allowed origin to the app URL | `_shared/supabase.ts` |
| **ERR-1** | **Low** | Error handling | Edge functions return raw `error.message` to the client on 500 | `create-checkout-session/index.ts:149`; `create-customer-portal-session/index.ts:97`; `stripe-webhook/index.ts:402-405` | Internal/Stripe error text surfaced to the caller | Return a generic message; log detail server-side only | both checkout functions; webhook |
| **ORACLE-1** | **Low** | Info disclosure | `can_create_group(uuid)` param is caller-overridable, so a user can probe any uuid's allowlist/access state | `0008:450` grant; body reads `auth.users` with row-security off `0012:25` | A logged-in user calls `can_create_group('<uuid>')` to learn if that user is beta-allowlisted (boolean, keyed by opaque uuid) | Ignore the param / force it to `auth.uid()` | `0012_can_create_group_jwt.sql`; `0008_private_beta.sql` |
| **OR-1** | **Low** | OAuth config | Prod redirect allowlist includes `https://pushus.pages.dev/...` (shared CF preview domain) | `supabase/config.toml:51` | If that preview subdomain is ever takeover-able it becomes an OAuth redirect target | Drop preview domains from the prod redirect allowlist | `supabase/config.toml` |
| **CFG-1** | **Low / Not verified** | Edge deploy | Per-function `verify_jwt` is not expressed in the repo (`config.toml` has no `[functions.*]` blocks); `stripe-webhook` and `send-push-reminders` rely on their own auth and must be deployed `--no-verify-jwt` | no `[functions.*]` in `config.toml` | If misconfigured, the webhook/cron reject legit calls, or (less likely) a function is exposed without its intended gateway JWT | Confirm in the dashboard: webhook + cron `verify_jwt=false`; nudge/checkout/portal `verify_jwt=true` | `supabase/config.toml` |
| INFO | Info | Session | Supabase session (access+refresh token) stored in `localStorage` (library default) | `src/lib/supabase.ts:24-34` (`persistSession:true`, no custom `storage`) | Standard SPA trade-off; only exploitable via an XSS sink, of which none exist | Keep CSP tight (see CSP-1); acceptable as-is | `src/lib/supabase.ts` |

---

## C. Must-fix before production

> **Implementation status (2026-07-11):** HD-1, P-1, BL-1 and H-1 are **implemented and pending deploy** — `public/_headers` + migrations `0042_guard_group_takeover.sql`, `0043_guest_import_hardening.sql`, `0044_billing_view_security_invoker.sql`. **S-1 (rotate `CRON_SECRET`) is a manual operator step — still outstanding.** BL-3 (webhook reprocessing) not yet done.

These block deployment (or block enabling billing / Cloud).

1. **HD-1 — Fix the Cloudflare header scope + add HSTS.** One-line change (`/` → `/*`). Today the app's real pages have no CSP and no clickjacking protection. Cheap, high value. **Blocks general production.**
2. **P-1 — Block admin→owner privilege escalation.** Add DB triggers so only the current owner can change `groups.owner_id` and `group_members.role` to/from `owner`. **Blocks general production**; critical for Cloud (owner controls billing).
3. **BL-1 — Make `import_guest_reps` one-time and capped.** Without this, any member can fabricate unlimited reps/XP/badges and defeat the oversize-review anti-cheat. **Blocks general production** (leaderboard/gamification integrity).
4. **S-1 — Rotate `CRON_SECRET` and remove `.env.push-reminders` from the Dropbox tree.** Treat the current value as already exposed. **Blocks production.**

**Additionally, before enabling Stripe billing / PushUS Cloud:**

5. **H-1 — `security_invoker = true` on `group_subscriptions_owner`, `group_availability`, `deployment_settings_public`.** Must land before any subscription rows exist.
6. **BL-3 — Fix the webhook's failed-event reprocessing** so a transient error doesn't permanently desync a group's billing state.

---

## D. Should-fix soon

Important hardening; does not necessarily block a beta launch.

1. **IV-1 — Harden invites:** longer random codes (≥16 chars), enforce the existing `default_invite_limit`/`invite_slots_override` in `request_join_group`, add expiry, and reconsider auto-`active` + beta-bypass for a shared reusable code.
2. **BL-2 — Add a hard server-side rep ceiling** in `bank_pushups`/`record_entry_effort` independent of the warn/override UX (e.g. reject `count > 5000`).
3. **RL-1 — Add rate limiting** on magic-link requests, the anonymous invite RPCs, and the checkout/portal functions; make the cron-secret compare constant-time.
4. **DEF-1 — Fix the dead `'pending_review'` guard** in `update_pushup_entry` (it's also a functional bug in edit-yesterday for members).
5. **REV-1 / MATE-1 — Close the admin self-approval and the mate-block-escape** business-logic gaps.
6. **CFG-1 — Verify per-function `verify_jwt`** in the dashboard (operational check).
7. **ERR-1 / CORS-1 — Tighten edge-function error responses and CORS origin.**

---

## E. Nice-to-have hardening

1. **CSP-1** — remove `script-src 'unsafe-inline'` by hashing/nonce-ing the version-bootstrap script.
2. **SW-1** and `pwaOpenInApp.ts` — reject protocol-relative `//host` paths everywhere (one shared helper).
3. **ORACLE-1** — force `can_create_group` to `auth.uid()`.
4. **OR-1** — drop `pushus.pages.dev` from the production OAuth redirect allowlist.
5. Add a **CSP `report-uri`/`report-to`** endpoint to catch injection attempts in the wild.
6. Scrub edge-function `console.error(error)` calls so full Stripe/DB error objects (which can contain customer email) aren't written verbatim to logs; log a correlation id + message instead.
7. Add automated secret-scanning (e.g. `gitleaks`) to CI to keep the current clean state.
8. Consider a dedicated **throwaway Supabase project for CI** RLS/billing tests rather than any prod-linked secrets (**Not verified** which project the CI `SUPABASE_*` secrets point to — if prod, move them).

---

## F. Code-level fixes

Small, targeted diffs — no rewrites needed. Add each as a new numbered migration (don't edit shipped ones).

### F-1 (H-1) — Make the billing views respect RLS  ✅ IMPLEMENTED in `0044_billing_view_security_invoker.sql`

```sql
ALTER VIEW public.group_subscriptions_owner SET (security_invoker = true);
ALTER VIEW public.group_availability        SET (security_invoker = true);
```

With `security_invoker`, `group_subscriptions_owner` is filtered by the base-table policy `group_subscriptions_select_owner` (`is_group_owner(group_id)`), so a caller sees only groups they own (verified: the only reader, `useBilling.ts:16`, already filters by its own `group_id`). `group_availability` is unused by the frontend.

> ⚠️ **Do NOT** add `security_invoker` to `deployment_settings_public`. Its base table `deployment_settings` has a **deny-all** policy (`deployment_settings_deny_all`), so an invoker-checked view would return **zero rows** and break deployment-settings loading (`billing_enabled`, `deployment_mode`). It is a deliberate definer view exposing only three non-sensitive columns — leave it as-is.

### F-2 (P-1) — Block role / owner tampering  ✅ IMPLEMENTED in `0042_guard_group_takeover.sql` (surgical: only *granting* owner / changing `owner_id` by a non-owner is blocked; normal admin work and owner transfers pass)

```sql
-- supabase/migrations/0043_guard_group_takeover.sql
-- Only the current owner may reassign ownership.
CREATE OR REPLACE FUNCTION public.guard_groups_owner_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF session_user IN ('service_role','postgres','supabase_admin')
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND NOT public.is_group_owner(OLD.id) THEN
    RAISE EXCEPTION 'Only the current owner can transfer ownership';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER groups_guard_owner_column
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.guard_groups_owner_column();

-- Only the owner may grant/revoke the 'owner' role via membership rows.
CREATE OR REPLACE FUNCTION public.guard_member_owner_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF session_user IN ('service_role','postgres','supabase_admin')
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF (NEW.role = 'owner' OR OLD.role = 'owner')
     AND NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_group_owner(OLD.group_id) THEN
    RAISE EXCEPTION 'Only the current owner can change the owner role';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER group_members_guard_owner_role
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_owner_role();
```

(Ownership transfer should ideally be its own `SECURITY DEFINER` RPC that also flips the previous owner to `admin` atomically.)

### F-3 (BL-1) — One-time, capped, policy-respecting guest import  ✅ IMPLEMENTED in `0043_guest_import_hardening.sql` (adds `guest_import_claims` marker table; caps payload at 60; routes counts through `resolve_oversize_review_status`)

In `import_guest_reps` (`0039`):
- Add an idempotency guard, e.g. a `guest_import_done boolean` flag on `group_members` (or a unique `source='guest_import'` marker), and `RAISE EXCEPTION 'Guest reps already imported'` if set.
- Cap the array: `IF jsonb_array_length(p_entries) > 60 THEN RAISE EXCEPTION 'Too many entries'; END IF;`
- Don't hard-code `review_status => 'none'`; compute it via `public.resolve_oversize_review_status(p_group_id, parsed.count)` so oversize `block`/`admin_review` groups still moderate imported sets.

### F-4 (HD-1) — Header scope + HSTS (`public/_headers`)  ✅ IMPLEMENTED

The security headers now live under a dedicated `/*` block (so deep links get them) with **no** `Cache-Control` in that block, so the more-specific cache rules (`/assets/*` immutable, `/sw.js` / `/version.json` no-cache, `/` + `/index.html` no-store) keep governing caching with no conflict. HSTS added.

> ⚠️ **CSP correction (important):** the app loads **Google Fonts** (`@import` in `src/styles/tokens.css:6` → `fonts.googleapis.com` for the stylesheet + `fonts.gstatic.com` for the woff2 files). The original `style-src 'self'; font-src 'self'` CSP would have **blocked the app's fonts** the moment it applied to real routes. The shipped CSP therefore allows those two hosts:
> `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; … font-src 'self' https://fonts.gstatic.com`.
> Future hardening (privacy-first): self-host the two fonts and drop the Google hosts from the CSP.

### F-5 (BL-3) — Reprocess non-duplicate-but-unfinished webhook events

In `stripe-webhook/index.ts`, when `recordBillingEvent` reports the row already exists, read its `processing_status` and only short-circuit when it is `processed`; otherwise fall through to `handleEvent` (the per-table upserts are already idempotent). This turns Stripe's automatic retries into real recovery instead of silent drops.

### F-6 (DEF-1) — one-character fix

`0041_edit_yesterday.sql:64`: `IN ('pending_review','rejected')` → `IN ('pending','rejected')`.

### F-7 (REV-1) — no self-approval

`0033_entry_review_admin.sql`, in `review_entry` after the admin check:
```sql
IF v_entry.user_id = auth.uid() THEN
  RAISE EXCEPTION 'You cannot review your own entry';
END IF;
```

### F-8 (RL-1) — constant-time cron compare

`send-push-reminders/index.ts:244` — replace `!==` with a length-checked constant-time comparison (e.g. `crypto.subtle` HMAC-compare or a fixed-time byte loop). And configure Supabase Auth rate limits for OTP email in the dashboard.

### F-9 (ERR-1 / CORS-1) — quieter errors, tighter CORS

Return a generic `{ error: 'Internal server error' }` to clients on 500 in the checkout/portal functions (keep `console.error` server-side). In `_shared/supabase.ts:corsHeaders()`, replace `'*'` with the deployment's `APP_BASE_URL`.

---

## G. Tests to add

Add these as regression tests (the repo already has `test:rls` and `test:billing` harnesses — extend them).

**AuthZ / RLS**
1. **H-1:** as user A (owner of group 1) and user B (owner of group 2), assert `select * from group_subscriptions_owner` and `group_availability` each return only the caller's own group after the `security_invoker` fix.
2. **P-1:** as a group *admin* (not owner), assert `update groups set owner_id = <self>` and `update group_members set role='owner'` both **raise**; as owner they succeed.
3. Re-assert the existing safe direct-writes stay safe: a non-admin member cannot `insert into user_custom_badges` / `competitions` (RLS `WITH CHECK` on `awarded_by`/`created_by` + `is_group_admin`).

**Business logic / fraud**
4. **BL-1:** call `import_guest_reps` twice → second call raises; call with a 100-element array → raises/caps; in a `block` group, imported oversize entries land `pending`, not `none`.
5. **BL-2:** `bank_pushups(count => 2000000000)` is rejected by the server ceiling.
6. **REV-1:** an admin calling `review_entry` on their own `pending` entry raises.
7. **MATE-1:** A blocks B; B's `block_mate(A)` + `unblock_mate` cannot clear A's block.
8. **DEF-1:** a member editing their own same-day entry succeeds (no enum error); a member cannot edit an entry that is under moderation hold.

**Webhook / billing**
9. **BL-3:** deliver an event that throws on first handling (mock `subscriptions.retrieve` to fail once), then redeliver the same `event.id` → the second delivery reprocesses and reaches `processed`.
10. Signature test: a body with an invalid/absent `stripe-signature` returns 400 and writes nothing.

**Headers / frontend**
11. **HD-1:** an HTTP fetch of `/login` and `/join/<code>` returns `Content-Security-Policy`, `X-Frame-Options: DENY`, and `Strict-Transport-Security` (a Playwright response-header assertion).
12. **SW-1:** unit-test the `notificationclick` URL resolver rejects `//evil.com` and absolute cross-origin URLs, allows `/today`.

---

## H. Final action plan (priority order)

**1. Fix immediately (this week, before/with the next deploy)**
- [ ] HD-1 — `_headers` `/` → `/*` + HSTS (F-4).
- [ ] P-1 — owner/role guard triggers (F-2).
- [ ] BL-1 — one-time + capped + policy-respecting `import_guest_reps` (F-3).
- [ ] S-1 — rotate `CRON_SECRET`; delete `.env.push-reminders` from the Dropbox tree; store only in GH Actions + Supabase secrets.
- [ ] DEF-1 — the one-character enum fix (F-6).

**2. Fix before enabling Stripe billing / Cloud**
- [ ] H-1 — `security_invoker=true` on the billing views (F-1).
- [ ] BL-3 — webhook failed-event reprocessing (F-5).
- [ ] Specialist pass: Stripe test-mode replay + failed-retry + idempotency test (G-9/G-10).

**3. Verify with tests**
- [ ] Add tests G-1…G-12; wire `test:rls`/`test:billing` into CI as required checks (they already run in `ci.yml`).
- [ ] Confirm per-function `verify_jwt` in the Supabase dashboard (CFG-1): webhook + cron = false, others = true.
- [ ] Confirm the CI `SUPABASE_*` secrets point at a throwaway test project, not prod (Not verified).

**4. Deploy safely**
- [ ] Ship migrations `0042`+ via `npx supabase db push` to prod; re-run `test:rls`/`test:billing` against a staging project first.
- [ ] Re-check response headers on live deep links (G-11).

**5. Monitor after deployment**
- [ ] Alert on `billing_events.processing_status IN ('pending','failed')` older than a few minutes (catches BL-3 in the wild).
- [ ] Watch `notification_events` failure rates and `pushup_entries` with implausible `count` (catches BL-1/BL-2 abuse).
- [ ] Add `gitleaks` + CSP `report-to` to CI/runtime for ongoing coverage.

---

### Appendix — things checked and found solid (no action needed)

- RLS enabled on **all 40** public tables; the blanket `GRANT … ON ALL TABLES TO authenticated` is safe because every table is RLS-protected and writes are RPC-mediated (default-deny).
- **All ~120 `SECURITY DEFINER` functions pin `search_path`**; the newest ones use the stricter `SET search_path = ''` with fully-qualified names.
- **No dynamic SQL / no injection** in any client-callable RPC; `count`/duration/RIR inputs are all bounds- or enum-checked.
- **Mates RPCs** (`request_mate`, `respond_mate_request`, `remove_mate`, `redeem_mate_code`, `rotate_mate_code`, `record_nudge`, `create_mate_challenge`, …) all derive the actor from `auth.uid()`, require a real mate relationship, and (nudge) enforce a per-day limit — no cross-user IDOR.
- **Profile / join / entry RPCs** (`complete_onboarding_profile`, `update_my_profile`, `upsert_member_alias`, `approve_join_request`, `undo_last_entry`, `delete_pushup_entry`, `record_entry_effort`, `mark_entry_override`, `set_availability`, `end_injury`) all scope writes to `auth.uid()` / verified admin.
- **Stripe webhook** verifies the signature (`constructEvent`) and is idempotent via a unique `billing_events.stripe_event_id`.
- **Frontend:** no `dangerouslySetInnerHTML`/`innerHTML`/`eval`/markdown sink; React escapes all user text; the invite OG page escapes the group name (`inviteOgHtml.ts:36`); auth uses PKCE; open-redirect is guarded (`postAuthNavigation.ts:56` blocks `//host`); all `target="_blank"` carry `rel="noopener noreferrer"`; no secret is referenced outside `VITE_*`.
- **Supply chain:** dependencies exact-pinned, no `postinstall` scripts, CI runs `npm audit --audit-level=high`.
