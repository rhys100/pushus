# Push reminders go-live

Web push reminder **code is deployed** on Supabase. Finish these steps so users can turn on reminders on [pushus.app](https://www.pushus.app).

## Already done (hosted Supabase)

- Edge function `send-push-reminders` deployed (`--no-verify-jwt`)
- Secrets set: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (**required** — function rejects unauthenticated calls)
- Hourly cron workflow: `.github/workflows/push-reminders-cron.yml` (needs GitHub secrets)

## Rhys: finish deployment

### 1. Cloudflare Pages — frontend VAPID key

In **Cloudflare Pages → pushus → Settings → Environment variables** (Production):

| Variable | Value |
|----------|-------|
| `VITE_VAPID_PUBLIC_KEY` | Public key from `.env.push-reminders` (local, gitignored) |

Redeploy the site (or trigger a new build from `main`).

Without this, Settings shows: *Push is not configured on this deployment (missing VAPID public key).*

### 2. GitHub Actions — hourly cron

In **GitHub → rhys100/pushus → Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `SUPABASE_PROJECT_REF` | `zcwvvhuihqlldnbwhivl` |
| `CRON_SECRET` | Same value as Supabase `CRON_SECRET` (see `.env.push-reminders`) |

The workflow runs at **:05 past each hour UTC**. You can also run it manually: **Actions → Push reminders cron → Run workflow**.

If secrets are missing, the workflow exits cleanly with a skip message (no failed builds).

### 3. Phone test

1. Open **https://www.pushus.app/settings** after redeploy.
2. **Turn on** push reminders — allow browser notifications.
3. Set active hours to include the current hour.
4. Ensure today’s logged count is below your daily target.
5. Run the cron workflow manually (or wait for the next hour).
6. Confirm a notification: *You still have N push-ups to bank today.*

**iOS:** Add the site to the home screen (PWA) for reliable web push.

**Android / desktop Chrome:** Works in the browser tab after permission is granted.

### 4. Manual curl (optional)

```bash
curl -X POST "https://zcwvvhuihqlldnbwhivl.supabase.co/functions/v1/send-push-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Expected when no eligible users: `{"sent":0,"skipped":0,"failed":0,"disabled":0}`

Unauthenticated or missing `CRON_SECRET` requests return `401 Unauthorized` or `500 Server misconfigured`.

## Operations

- **Audit:** `notification_events` table (RLS: users see own rows)
- **Stale subscriptions:** 410/404 responses auto-disable `push_subscriptions`
- **Rotate keys:** Generate new VAPID pair, update Cloudflare + Supabase secrets, users re-enable push in Settings

See also: [notifications.md](./notifications.md)
