# PushUS — Pre-Production Security Audit

**Reviewer:** Senior security engineer (pre-production audit)
**Date:** 2026-07-07
**Scope reviewed:** `push-ups-app` — React/Vite SPA, Supabase (Postgres + RLS + Edge Functions), Cloudflare Pages + Pages Functions, Stripe billing, web-push reminders, GitHub Actions.
**Method:** File-by-file inspection of migrations (`0001`–`0028`), all RLS policies and `SECURITY DEFINER` RPCs, all Supabase Edge Functions, Cloudflare Pages Functions, frontend auth/session/routing, `_headers`, CI, and env handling. Findings are tied to specific code with file/line references. Where I could not confirm something from the codebase it is marked **Not verified**.

---

## A. Executive summary

**Overall security rating: Moderate Risk** (with two items that become **High Risk the moment paid "PushUS Cloud" billing is switched on**).

This is a genuinely well-built app from a security standpoint. It does the hard things right: Row Level Security is enabled on every table, all writes go through `SECURITY DEFINER` RPCs that re-check authentication and group membership, the Stripe webhook verifies signatures and is idempotent, secrets are kept server-side, there are no dangerous HTML/`eval` sinks in the frontend, and there is a real Content-Security-Policy. It is clearly not a naive "trust the frontend" application — the server (Postgres RLS/RPC) is the source of truth for access.

**Is it safe for production today?** For the current **Community / private-beta** configuration (billing disabled, honour-system push-up counts, no payment or PII beyond email + display name): **Yes, with the fixes in section C applied** — chiefly the Cloudflare security-header scope bug and the admin→owner escalation guard. For **PushUS Cloud with real Stripe billing**: **Not yet** — the billing views bypass RLS (finding H-1) and must be fixed first.

**Top 5 concerns in plain English:**

1. **Billing data can leak across customers once billing is turned on.** A database "view" used to show a group its own subscription was created in a way that skips the security rules, so any signed-in user could read *every* group's subscription details. Harmless today (no billing data exists in beta) but a serious data-leak the day Cloud launches.
2. **A group admin can silently promote themselves to owner and take over the group** (delete it, or in Cloud, hijack the paid subscription). The database lets admins edit membership roles and the group's owner field with no guard.
3. **Your security headers only protect the homepage, not the actual app.** The Cloudflare header rule is written for `/` (the root URL only), so pages like `/login`, `/today`, and `/join/<code>` are served with no clickjacking protection and no Content-Security-Policy. HSTS is missing entirely.
4. **Invite codes are short, guessable, unlimited-use, and anonymously checkable.** Anyone (not even logged in) can test codes with no rate limit, and a valid code instantly grants full active membership *and* bypasses the private-beta allowlist.
5. **A live cron secret sits in plaintext inside a Dropbox-synced folder** (`.env.push-reminders`). It is correctly kept out of git, but Dropbox sync is its own exposure channel; leaking it lets an attacker spam every user's push notifications.

**Highest-priority fixes:** (1) add `security_invoker = true` to the billing views; (2) add a trigger to block role/owner tampering; (3) change the `_headers` path from `/` to `/*` and add HSTS; (4) rotate the cron secret and move it out of Dropbox; (5) lengthen invite codes and rate-limit the anonymous invite RPCs.

**Needs specialist review:** Stripe billing go-live (the view fix + a Stripe test-mode webhook replay/idempotency test), and a one-time Supabase Edge Function deployment-config check (`verify_jwt` per function — not expressible in the repo, see H-9).

---

## B. Risk table

| # | Severity | Area | Issue | Evidence | Exploit scenario | Recommended fix | Files |
|---|----------|------|-------|----------|------------------|-----------------|-------|
| H-1 | **High** (latent until billing on) | DB / multi-tenant | Billing views omit `security_invoker`, so they run as the table-owner and bypass the owner-only RLS on the base tables | `CREATE VIEW public.group_subscriptions_owner …` / `group_availability` with no `security_invoker`; base table RLS is owner-only | Any authenticated user runs `select * from group_subscriptions_owner` and reads every group's plan, trial dates, period end, cancellation state | `ALTER VIEW … SET (security_invoker = true)` on all 3 views | `supabase/migrations/0003_billing.sql:428,444`, `0008_private_beta.sql:12`, `src/hooks/useBilling.ts:16` |
| P-1 | **Medium** | AuthZ / priv-esc | An admin can set their own `group_members.role='owner'` and/or reassign `groups.owner_id`; no column guard | `group_members_update_admin` (USING/CHECK only require admin); `groups_update_owner_admin`; `guard_groups_billing_columns` guards only billing cols | A group admin promotes to owner, deletes the group or (Cloud) cancels/hijacks the Stripe subscription and removes the real owner | Add BEFORE UPDATE triggers blocking `role`/`owner_id` changes by non-owners | `0002_rls_core.sql:1137,1160`, `0007_rls_member_list.sql:14`, `0019_security_hardening.sql:8` |
| HD-1 | **Medium** | Headers / infra | Security headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) are scoped to `/` only; deep-linked app routes get none. HSTS absent | `public/_headers:4` rule is `/` not `/*` | Clickjacking of `/login`/`/join/<code>`; no CSP on the pages that render invite data; no HSTS downgrade protection | Change `/` → `/*`; add `Strict-Transport-Security` | `public/_headers` |
| IV-1 | **Medium** | Access / abuse | Invite codes are 8 hex chars (~32 bits), unlimited-use, never expire, checkable anonymously with no rate limit; a valid code bypasses the private-beta allowlist and auto-joins as `active` | `generate_invite_code()` (`0001_core.sql:98`), `is_valid_invite_code`/`get_invite_group_preview` granted to `anon` (`0008:448`,`0014:76`), auto-join `active` (`0016_invite_auto_join.sql`) | Enumerate/guess a code → anonymous group-name oracle → any signed-in user auto-joins group and bypasses beta gate | Longer codes; rate-limit anon RPCs; per-invite tokens with expiry/use-limits; keep approval for non-allowlisted users | `0001_core.sql:98`, `0008_private_beta.sql`, `0014`, `0016` |
| S-1 | **Medium** | Secrets | Live `CRON_SECRET`, project ref, VAPID key stored plaintext in `.env.push-reminders` inside a Dropbox-synced working directory | `.env.push-reminders:8` `CRON_SECRET=NAPUe…`; working dir is under `Dropbox/` | Dropbox sync/share leak → attacker POSTs to `send-push-reminders` repeatedly, spamming all users' notifications | Rotate secret; store outside synced folders (a secrets manager / CI secret only) | `.env.push-reminders` |
| RL-1 | **Medium** | Rate limiting | No app-level rate limiting on auth, invite validation, RPCs, or edge functions; reminder-secret compare is not constant-time | No limiter anywhere; `send-push-reminders` uses `!==` on the secret (`index.ts:226`) | Brute-force invite codes / magic-link email bombing / RPC hammering; Supabase platform limits are not configured or verified | Add Supabase/edge rate limiting or a CF Turnstile on public entry points; constant-time compare the cron secret | `supabase/functions/*`, RLS RPCs |
| CSP-1 | **Low** | XSS hardening | CSP allows `script-src 'unsafe-inline'` (needed for the injected version-bootstrap script) | `public/_headers:10`; inline script in `vite.config.ts:27` | Weakens CSP as an XSS backstop (no active XSS sink found today) | Move bootstrap script to a hashed/nonce'd script; drop `'unsafe-inline'` | `public/_headers`, `vite.config.ts` |
| CORS-1 | **Low** | Edge functions | `Access-Control-Allow-Origin: *` on checkout/portal functions | `supabase/functions/_shared/supabase.ts:39` | Any origin can call with a stolen bearer token (token still required) | Restrict allowed origin to the app URL | `_shared/supabase.ts` |
| ERR-1 | **Low** | Error handling | Edge functions return raw `error.message` to the client on 500 | `create-checkout-session/index.ts:149`, `create-customer-portal-session/index.ts:97` | Internal/Stripe error text surfaced to caller | Return a generic message; log detail server-side only | both checkout functions |
| OR-1 | **Low** | OAuth config | `additional_redirect_urls` includes `https://pushus.pages.dev/...` (shared CF preview domain) | `supabase/config.toml:51` | If the preview subdomain is ever takeover-able, it becomes an OAuth redirect target | Drop preview domains from prod redirect allowlist | `supabase/config.toml` |
| CFG-1 | **Low / Not verified** | Edge deploy | Per-function `verify_jwt` settings are not in the repo | no `[functions.*]` blocks in `config.toml` | If misconfigured, webhook/cron functions could reject legit calls or (less likely) expose others | Confirm `stripe-webhook` + `send-push-reminders` deployed `--no-verify-jwt`; others JWT-verified | `supabase/config.toml` |

---

## C. Must-fix before production

These block deployment (or block enabling billing/Cloud).

1. **HD-1 — Fix Cloudflare header scope + add HSTS.** One-line change (`/` → `/*`). Without this, the app's real pages have no CSP and no clickjacking protection. Cheap, high value. **Blocks general production.**
2. **P-1 — Block admin→owner privilege escalation.** Add DB triggers so only the current owner can change `group_members.role` to/from `owner` and change `groups.owner_id`. **Blocks general production** (and is critical for Cloud where owner controls billing).
3. **H-1 — Add `security_invoker = true` to `group_subscriptions_owner`, `group_availability`, `deployment_settings_public`.** **Blocks enabling billing / PushUS Cloud.** (Latent while billing is off, but must land before any subscription rows exist.)
4. **S-1 — Rotate `CRON_SECRET` and remove `.env.push-reminders` from the Dropbox-synced tree.** Store it only in GitHub Actions + Supabase secrets. **Blocks production** because the current value must be treated as already exposed.

---

## D. Should-fix soon

Important hardening; does not necessarily block a beta launch.

1. **IV-1 — Harden invites:** increase invite-code entropy (≥16 random chars), enforce use-limits/expiry (the `default_invite_limit`/`invite_slots_override` columns already exist but are **not enforced** in `request_join_group`), and reconsider auto-`active` join for users who are not allowlisted.
2. **RL-1 — Add rate limiting** on: magic-link requests, `is_valid_invite_code`/`get_invite_group_preview` (anonymous), and the checkout/portal functions. Make the cron-secret comparison constant-time.
3. **CFG-1 — Verify Edge Function `verify_jwt` config** for all four functions (operational check, see H-9).
4. **ERR-1 / CORS-1 — Tighten edge function error responses and CORS origin.**

---

## E. Nice-to-have hardening

1. **CSP-1** — Replace `'unsafe-inline'` in `script-src` with a hash/nonce for the version-bootstrap script.
2. Add a `Content-Security-Policy-Report-Only` + report endpoint to catch violations before tightening.
3. **OR-1** — Remove `pushus.pages.dev` and localhost from the **production** redirect allowlist.
4. Repo housekeeping: delete the many stray `vite.config.ts.timestamp-*.mjs` / `vitest.config.ts.timestamp-*.mjs` files (gitignored but present on disk).
5. Add `email` to the audit trail actor context and consider retention/erasure policy for `pushup_entry_audit_log` and `notification_events` (contains user IDs + activity).
6. Consider `FORCE ROW LEVEL SECURITY` on the most sensitive tables (`billing_*`, `group_subscriptions`, `beta_allowed_emails`) as belt-and-braces against future definer-view mistakes.

---

## F. Code-level fixes

### F-1 (H-1) Billing views bypass RLS — add `security_invoker`

**Why:** In Postgres, a normal view runs with the *view owner's* privileges. Migrations run as `postgres`, which owns the base tables and is not subject to their RLS. So `group_subscriptions_owner` (granted to `authenticated`, `0003_billing.sql:503`) returns **all** groups' rows, defeating `group_subscriptions_select_owner` (`0003_billing.sql:477`). Postgres 15 (`config.toml:15`) supports `security_invoker`.

Add a new migration `supabase/migrations/0029_view_security_invoker.sql`:

```sql
-- Views must enforce the querying user's RLS, not the owner's.
ALTER VIEW public.group_subscriptions_owner  SET (security_invoker = true);
ALTER VIEW public.group_availability         SET (security_invoker = true);
ALTER VIEW public.deployment_settings_public SET (security_invoker = true);
```

**Caveat to test:** `deployment_settings_public` is intentionally readable by `anon`, but `deployment_settings` has a `deny_all` RLS policy (`0003_billing.sql:462`). With `security_invoker=true` the anon read of the view will now be denied. So `deployment_settings_public` should instead be fed by the existing `SECURITY DEFINER` function `get_deployment_settings()` (already granted to anon), **or** add an explicit `SELECT` policy that allows reading only the non-sensitive columns. Recommended: keep the view `security_invoker=true` for the two billing views, and for `deployment_settings_public` add a scoped read policy:

```sql
ALTER VIEW public.deployment_settings_public SET (security_invoker = true);

CREATE POLICY deployment_settings_public_read
  ON public.deployment_settings
  FOR SELECT TO anon, authenticated
  USING (true);   -- only the 4 non-sensitive columns are exposed via the view
```

**Regression test:** as a non-owner authenticated user, `select * from group_subscriptions_owner` must return only groups you own (ideally 0 rows for a non-owner). See G-1.

### F-2 (P-1) Block admin→owner takeover

**Why:** `group_members_update_admin` (`0007_rls_member_list.sql:14`) lets any admin UPDATE any membership row, and `groups_update_owner_admin` (`0002_rls_core.sql:1137`) lets any admin UPDATE the group; the only column guard (`guard_groups_billing_columns`, `0019:8`) covers billing columns, not `role` or `owner_id`. So an admin can `UPDATE group_members SET role='owner' WHERE user_id=<self>` and `UPDATE groups SET owner_id=<self>`.

Add `supabase/migrations/0030_owner_transfer_guard.sql`:

```sql
-- Only the current owner may grant/revoke the 'owner' role.
CREATE OR REPLACE FUNCTION public.guard_group_member_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF session_user IN ('service_role','postgres','supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     AND (NEW.role = 'owner' OR OLD.role = 'owner')
     AND NOT public.is_group_owner(OLD.group_id) THEN
    RAISE EXCEPTION 'Only the group owner can transfer ownership';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_members_guard_role ON public.group_members;
CREATE TRIGGER group_members_guard_role
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_group_member_role();

-- owner_id may only change via a controlled transfer (owner-initiated).
CREATE OR REPLACE FUNCTION public.guard_groups_owner_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF session_user IN ('service_role','postgres','supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND NOT public.is_group_owner(OLD.id) THEN
    RAISE EXCEPTION 'Only the current owner can reassign ownership';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_guard_owner ON public.groups;
CREATE TRIGGER groups_guard_owner
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.guard_groups_owner_column();
```

> Note: `is_group_owner(OLD.id)` returns true only if the caller currently holds `role='owner'`, so an admin trying to self-promote is rejected because they are not yet owner. A proper "transfer ownership" flow should be a dedicated RPC run by the current owner.

### F-3 (HD-1) Fix header scope + add HSTS

**Why:** Cloudflare Pages `_headers` matches by path. `/` (`public/_headers:4`) matches only the root document; `/login`, `/today`, `/join/<code>` receive none of the security headers. Change the path to `/*` and add HSTS.

```
# public/_headers
/*
  Cache-Control: no-store, must-revalidate
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), vibrate=(self)
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

Keep the existing per-asset `Cache-Control` blocks below; note that `no-store` on `/*` would also apply to hashed assets, so keep the `/assets/*` and `/pwa/*` immutable-cache rules **after** the `/*` block (later, more specific rules win in CF Pages) — verify caching behaviour after deploy.

### F-4 (S-1) Rotate and relocate the cron secret

- Rotate `CRON_SECRET` in Supabase (`supabase secrets set CRON_SECRET=<new>`) and update the GitHub Actions secret.
- Delete `.env.push-reminders` from the working tree (it's already gitignored) and keep those values only in GitHub Actions secrets + Supabase secrets. Treat the current value as compromised.
- In `send-push-reminders/index.ts:226`, use a constant-time compare:

```ts
import { timingSafeEqual } from 'node:crypto'
function safeEq(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a), bb = new TextEncoder().encode(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
// ...
const header = req.headers.get('Authorization') ?? ''
if (!safeEq(header, `Bearer ${cronSecret}`)) {
  return jsonResponse({ error: 'Unauthorized' }, 401)
}
```

### F-5 (IV-1) Harden invites

- Longer code (defense against enumeration), e.g.:

```sql
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT lower(encode(gen_random_bytes(12), 'hex'));  -- 24 chars, 96-bit
$$;
```

- Enforce the already-modelled invite limits in `request_join_group` (the `default_invite_limit`/`invite_slots_override` columns exist in `0001_core.sql` but are never checked), or move to single-use invite tokens with `expires_at`.
- Consider not auto-joining non-allowlisted users as `active` during private beta — require admin approval unless the joiner is allowlisted. See `0016_invite_auto_join.sql`.
- Rate-limit `is_valid_invite_code` and `get_invite_group_preview` (both granted to `anon`).

### F-6 (ERR-1 / CORS-1) Edge function hygiene

- In both checkout functions, replace `jsonResponse({ error: message }, 500)` with a generic `'Something went wrong'` and keep `console.error(error)` for server logs.
- In `corsHeaders()` (`_shared/supabase.ts:39`), return the app origin instead of `*`:

```ts
export function corsHeaders(): HeadersInit {
  const origin = Deno.env.get('APP_BASE_URL') ?? 'https://www.pushus.app'
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}
```

---

## G. Tests to add

Extend the existing `tests/rls/*` (Vitest) and `tests/billing/*` suites; these already exercise RLS with anon/service clients, so the patterns exist.

**G-1 (H-1 regression) — billing view isolation:**
- As authenticated **non-owner** user B, `from('group_subscriptions_owner').select('*')` must return **0 rows** for a group owned by A. (Today, pre-fix, it returns A's row — the test should fail before F-1 and pass after.)
- Same for `group_availability` (should not enumerate other groups' billing state).

**G-2 (P-1 regression) — role/owner tamper:**
- As an **admin** (not owner), `update('group_members').eq('user_id', self).set({role:'owner'})` must be **rejected**.
- As an admin, `update('groups').eq('id', g).set({owner_id: self})` must be **rejected**.
- As the **owner**, an explicit ownership-transfer path succeeds (once implemented).

**G-3 (AuthZ) — cross-tenant IDOR sweep:** For each RPC that takes an id (`bank_pushups`, `update_pushup_entry`, `delete_pushup_entry`, `record_entry_effort`, `approve_join_request`, `reject_join_request`, `upsert_member_alias`, `list_group_members`, `list_pending_join_requests`), assert a user from group X gets an exception when passing an id belonging to group Y. (The RPCs look correct; lock the behaviour in.)

**G-4 (Webhook) — Stripe:**
- Invalid/absent `stripe-signature` → 400, no DB write (`stripe-webhook/index.ts:373,386`).
- Replay: posting the same `event.id` twice inserts one `billing_events` row and returns `duplicate:true` (`index.ts:392`).
- `checkout.session.completed` for group A never updates group B (`resolveGroupId` mapping).

**G-5 (Input validation):**
- `bank_pushups` rejects `count <= 0` and disallowed backdates (`0002_rls_core.sql:630,634`).
- `record_entry_effort` rejects RIR outside 0–10 and non-owning entries (`0022:47,61`).
- `normalize_name_initial` rejects multi-char/non-letter input (`0028:25`).

**G-6 (Invite/beta gate):**
- With `private_beta_enabled=true`, a user who is not allowlisted and has no valid invite cannot pass `user_has_app_access`, cannot `complete_onboarding_profile`, cannot `request_join_group`.
- After F-5, an expired/over-limit invite is rejected.

**G-7 (Headers, e2e/Playwright):** assert `/login` and `/join/<code>` responses include `content-security-policy` and `x-frame-options` (fails before F-3).

---

## H. Final action plan (priority order)

### 1. Fix immediately (before/along with launch)
- [ ] **F-3** `_headers` `/` → `/*`, add HSTS. *(HD-1)*
- [ ] **F-2** Add role/owner guard triggers. *(P-1)*
- [ ] **F-4** Rotate `CRON_SECRET`, delete `.env.push-reminders` from the synced tree, constant-time compare. *(S-1)*
- [ ] **F-1** Add `security_invoker=true` to billing views — **mandatory before enabling billing/Cloud.** *(H-1)*
- [ ] **F-5** Lengthen invite codes; rate-limit anon invite RPCs; reconsider auto-active join. *(IV-1)*

### 2. Verify with tests
- [ ] Land tests **G-1, G-2** (must fail before the fix, pass after).
- [ ] Add **G-3** cross-tenant IDOR sweep and **G-4** webhook replay/signature tests.
- [ ] Add **G-7** header assertion to the Playwright smoke suite.
- [ ] Keep `npm audit --audit-level=high` in CI (already present, `ci.yml:26`) and run `test:rls` + `test:billing` against a real Supabase (already wired).

### 3. Deploy safely
- [ ] Confirm Edge Function `verify_jwt` per function: `stripe-webhook` and `send-push-reminders` deployed `--no-verify-jwt`; `create-checkout-session`/`create-customer-portal-session` keep JWT verification (they also self-check `getUser()`). *(CFG-1)*
- [ ] Confirm all runtime secrets live only in Supabase secrets / Cloudflare Pages env / GitHub Actions secrets — never in `VITE_*` (build output). Current `VITE_*` usage is clean (public URL/anon key only).
- [ ] Set production Supabase redirect allowlist to the real domains only (drop `pages.dev`/localhost). *(OR-1)*
- [ ] Enable HSTS preload on the domain (after F-3) and confirm CSP doesn't break the app on real routes.

### 4. Monitor after deployment
- [ ] Alert on `billing_events.processing_status='failed'` and on Stripe webhook 4xx/5xx.
- [ ] Alert on spikes in `notification_events` of type `reminder_failed`, and on unexpected `send-push-reminders` invocation frequency (cron-secret abuse signal).
- [ ] Watch Supabase auth logs for magic-link request spikes (email-bomb / enumeration) and invite-RPC call spikes from `anon`.
- [ ] Periodically review the `pushup_entry_audit_log` for `admin_adjust`/`delete` patterns and any ownership changes.
- [ ] Re-run `npm audit` / dependency review on a schedule; the stack is lean (React, Supabase JS, react-query, date-fns, resvg) with no `postinstall` scripts in app deps — keep it that way.

---

## Appendix — What is already done well (so it isn't "fixed" away)

- **RLS on every table**, with membership/role helper functions (`is_group_member`, `is_group_admin`, `is_group_owner`) and consistent `assert_authenticated`/`assert_active_group_member`/`assert_group_writable` gates in RPCs (`0002_rls_core.sql`).
- **All writes go through `SECURITY DEFINER` RPCs**, not direct table writes; `pushup_entries` has no client INSERT/UPDATE policy — only reads — so counts can't be forged outside `bank_pushups` (which enforces backdate policy, oversize review, and audit logging).
- **Stripe webhook**: signature-verified (`constructEvent`), idempotent via unique `stripe_event_id` (23505 → duplicate), service-role only, group resolved via metadata/customer mapping (`stripe-webhook/index.ts`).
- **Billing column guard trigger** blocks clients from editing `billing_status`/`checkout_started_at` (`0019_security_hardening.sql`), and billing-status reads are membership-gated to prevent cross-tenant enumeration.
- **Secrets are server-side**: frontend uses only the anon key; service-role key appears only in Edge Functions and local test scaffolding that reads it from `supabase status` (`e2e/localAuth.ts`), never hardcoded. No real secrets are committed to git (verified).
- **No XSS/`eval` sinks** in the SPA; OG HTML and SVG generation escape user-controlled group names (`functions/_shared/inviteOgHtml.ts`, `ogImageTemplate.ts`); the service worker only navigates same-origin URLs (`public/sw.js`).
- **A real CSP exists** (content is good — just mis-scoped, see HD-1), plus `max_rows=1000` caps bulk exfiltration per query.
- **Self-reactions blocked**, audit log append-only, private-beta allowlist protected by both deny-all RLS and revoked grants.
