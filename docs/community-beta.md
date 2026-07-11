# PushUS Community beta deployment

This checklist is for the **PushUS Community Beta** — billing disabled, no Stripe, no Cloud billing configuration.

Do **not** enable Slice 1B Cloud billing for this deployment:

- Keep `billing_enabled=false` in `deployment_settings`
- Keep `VITE_BILLING_ENABLED=false` in the frontend build
- Do not configure Stripe production keys or webhooks

---

## 1. Supabase hosted project

1. Create a new project at [supabase.com](https://supabase.com) (choose a region close to beta users, e.g. Sydney).
2. Note the **Project URL** and **anon public** key from **Project Settings → API**.
3. Do **not** put the **service role** key in the frontend, git, or any public host env panel.

### Link CLI and apply migrations

From this repo root, with [Supabase CLI](https://supabase.com/docs/guides/cli) installed:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

This applies all files in `supabase/migrations/` in order (`0001` through `0007`).

**Do not** run `supabase db reset` against hosted production — that wipes data.

**Optional:** `supabase/seed.sql` is for local demo only. Skip it for the beta unless you deliberately want demo users.

### Confirm Community deployment settings

Migration `0003_billing.sql` seeds the singleton row with Community defaults. After `db push`, verify in **SQL Editor**:

```sql
SELECT deployment_mode, billing_enabled, default_billing_grace_days
FROM public.deployment_settings;
```

Expected:

| Column | Value |
|--------|-------|
| `deployment_mode` | `community` |
| `billing_enabled` | `false` |

If either value is wrong, fix before go-live:

```sql
UPDATE public.deployment_settings
SET deployment_mode = 'community',
    billing_enabled = false
WHERE id = '00000000-0000-0000-0000-000000000001';
```

Groups created in Community mode get `billing_status = exempt`. Write access is enforced by RLS and `can_group_write()` — billing gates stay off.

---

## 2. Auth configuration

### Email code (required)

In **Authentication → Providers → Email**:

- Enable email provider
- Enable email OTP
- Confirm sign-up is allowed for beta testers

In **Authentication → Email Templates → Magic Link**, copy the contents of
`supabase/templates/magic_link.html`. Despite the Supabase dashboard label, this
template sends the six-digit code used by PushUS.

In **Authentication → URL configuration**:

| Setting | Value |
|---------|-------|
| Site URL | Your production app URL, e.g. `https://beta.pushus.example.com` |
| Redirect URLs | Production callback **and** local dev if you still test locally |

Required redirect URL pattern (app uses `/auth/callback`):

```
https://YOUR_BETA_DOMAIN/auth/callback
```

For local dev alongside hosted Supabase:

```
http://127.0.0.1:5173/auth/callback
http://localhost:5173/auth/callback
```

### Google OAuth (optional)

In **Authentication → Providers → Google**:

1. Create OAuth credentials in Google Cloud Console (Web application).
2. Add authorised redirect URI from Supabase dashboard (shown on the Google provider page).
3. Paste Client ID and Client Secret into Supabase.
4. Enable the provider.

Beta works with email codes only. Google is optional convenience.

---

## 3. Frontend environment variables

Set these at **build time** on your static host (Vite inlines `VITE_*` vars).

Copy `.env.example` to `.env` for local builds. Never commit `.env`.

| Variable | Beta value |
|----------|------------|
| `VITE_SUPABASE_URL` | Hosted project URL |
| `VITE_SUPABASE_ANON_KEY` | Hosted anon public key |
| `VITE_APP_NAME` | `PushUS` |
| `VITE_APP_URL` | `https://www.pushus.app` |
| `VITE_BILLING_ENABLED` | `false` |
| `VITE_SOURCE_REPO_URL` | `https://github.com/rhys100/pushus` |
| `VITE_DEPLOYMENT_NAME` | `PushUS Community Beta` |
| `VITE_IS_MODIFIED_FORK` | `false` |

Leave Stripe vars empty/unset for beta:

- `VITE_STRIPE_PUBLISHABLE_KEY` — not used

**Push reminders (optional):** set `VITE_VAPID_PUBLIC_KEY` on Cloudflare Pages and complete [push-reminders-go-live.md](./push-reminders-go-live.md). Backend edge function and cron workflow are in the repo; frontend key + GitHub cron secrets are required for live reminders.

Example `.env` for production build:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_APP_NAME=PushUS
VITE_APP_URL=https://www.pushus.app
VITE_BILLING_ENABLED=false
VITE_SOURCE_REPO_URL=https://github.com/rhys100/pushus
VITE_DEPLOYMENT_NAME=PushUS Community Beta
VITE_IS_MODIFIED_FORK=false
```

---

## 4. Build and deploy

PushUS is a static SPA. Build locally or in CI, then deploy `dist/`.

### Build

```bash
npm ci
npm run build
```

Output: `dist/`

Optional pre-flight (local Supabase + Docker):

```bash
npm test
npm run test:integration
npm run test:e2e
```

### Deploy

Any static host works. Common options:

| Platform | Notes |
|----------|-------|
| **Cloudflare Pages** | Connect repo or upload `dist/`; set `VITE_*` in build env; build command `npm run build`; output `dist` |
| **Vercel** | Same pattern; framework preset Vite |
| **Netlify** | Build `npm run build`, publish `dist` |
| **nginx / S3** | Upload `dist/` contents; configure SPA fallback to `index.html` for client routes |

**SPA routing:** All paths (`/today`, `/group`, `/auth/callback`, etc.) must serve `index.html`. Without this, direct links and OAuth callbacks will 404.

**HTTPS:** Required for production auth redirects.

---

## 5. Post-deploy smoke check (desktop)

1. Open the beta URL — login page loads.
2. Request sign-in code — email arrives (check spam).
3. Enter the code — lands on Today or group setup.
4. About page shows **PushUS Community Beta** and source repo link.
5. Billing UI is hidden (`VITE_BILLING_ENABLED=false`).

---

## 6. Phone spot-check (Rhys)

Run on a real phone over mobile data (not just desktop DevTools). Use two separate email accounts.

### Setup

- [ ] **Create owner account** — sign up with the email code on phone; complete profile if prompted.
- [ ] **Create first group** — name, timezone (e.g. Australia/Sydney), daily target; note the invite code.

### Invite flow

- [ ] **Invite second account** — share invite code or link; join from a second device/browser with a different email.
- [ ] **Confirm pending screen** — second account sees pending/waiting UI, not group data, leaderboard, or member list.
- [ ] **Approve second account** — owner approves from Group → pending members.

### Logging

- [ ] **Log push-ups on phone** — use circular logger on Today; confirm count updates.
- [ ] **Test undo** — undo last log; count returns to previous value.
- [ ] **Test edit/delete** — edit an entry count; delete an entry; both persist after refresh.

### Social / privacy

- [ ] **Confirm leaderboard/feed** — both active members see each other on weekly/monthly leaderboard and activity feed.
- [ ] **Confirm pending/outsider privacy** — with a third account (or before approval), pending member cannot see entries, members, or leaderboard; outsider without invite cannot browse group data.

### Sign-off

- [ ] No billing prompts or Stripe checkout anywhere.
- [ ] Magic link login works on phone without desktop assist.
- [ ] **Push reminders (optional)** — Settings → Turn on; notification arrives when under daily target during active hours (see [push-reminders-go-live.md](./push-reminders-go-live.md)).

---

## 7. Out of scope for this beta

Do not enable or test in beta:

- Stripe / Cloud billing (`billing_enabled=true`, production Stripe)
- Training wizard and plan engine polish
- Achievements / XP polish beyond bug fixes found during setup

Push reminders are **in beta** once `VITE_VAPID_PUBLIC_KEY` and GitHub cron secrets are configured (see [push-reminders-go-live.md](./push-reminders-go-live.md)).

Cloud billing code remains in the repo but stays **disabled** until a separate Slice 1B go-live.

---

## 8. Rollback

| Layer | Rollback |
|-------|----------|
| Frontend | Redeploy previous `dist/` or revert host deployment |
| Database | Avoid destructive resets on hosted project; restore from Supabase backup if needed |
| Auth | Revert Site URL / redirect URLs in Supabase dashboard |

---

## Reference

- [self-hosting.md](self-hosting.md) — general Community setup
- [security.md](security.md) — RLS and key handling
- [privacy.md](privacy.md) — data model and pending-member rules
- [billing.md](billing.md) — **do not follow Cloud sections for this beta**
