# PushUS notifications

**Status:** Phase 3 — web push reminders shipped.

PushUS sends optional reminders when you are behind your goal during your chosen active hours and frequency. Reminders respect injury pause. Frequency can be hourly, every 2 hours, or once per local day.

## Architecture

- **Browser:** `public/sw.js` service worker receives push events via the native Push API (no `web-push` in the frontend bundle).
- **Frontend:** `src/lib/notifications/registerPush.ts` registers the service worker, requests permission, and stores subscriptions in Supabase.
- **PWA install path:** Android Chrome users get an **Install PushUS** bottom dock when the browser exposes the native install prompt. iPhone users get home-screen install instructions because iOS web push is most reliable from an installed web app. Installed web apps are the preferred path for reliable mobile reminders.
- **Database:** `notification_preferences`, `push_subscriptions`, and `notification_events` (see `supabase/migrations/0005_notifications.sql`).
- **Sender:** `supabase/functions/send-push-reminders` edge function (cron-style) uses `web-push` with VAPID keys.

## Eligibility rules

A user receives a reminder when all of the following are true:

1. `push_enabled` is true and at least one enabled push subscription exists.
2. Current local hour is within `[active_hours_start, active_hours_end)`.
3. Injury pause is off, or `injury_paused_until` is in the past.
4. Banked push-ups for today (across all groups) are below `daily_target`.
5. Enough time has passed since the last reminder for the chosen `reminder_interval_hours`:
   - **1** — at least one hour since `last_reminder_sent_at`
   - **2** — at least two hours
   - **24** — no reminder yet today (local timezone)

Default for new users: hourly reminders between **7:00** and **20:00** (7pm inclusive). Existing users keep once-daily until they change frequency in Settings.

Tapping a reminder opens the **log page** (`/today`). Reminder text mirrors the log page set planner when a training plan is active (e.g. “Bank about 8 — set 1 of 3 — tap to log”).

Shared logic lives in `src/lib/notificationEligibility.ts` and is mirrored in the edge function.

## Setup

### 1. Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Save the output securely. You need both keys.

### 2. Frontend environment

Add to `.env` (see `.env.example`):

```env
VITE_VAPID_PUBLIC_KEY=<your-public-key>
```

Redeploy or restart Vite after changing env vars.

### 3. Edge function secrets

Set these in Supabase (Dashboard → Edge Functions → Secrets, or CLI):

| Secret | Purpose |
|--------|---------|
| `VAPID_PUBLIC_KEY` | Same public key as frontend |
| `VAPID_PRIVATE_KEY` | Private VAPID key (server only) |
| `VAPID_SUBJECT` | Contact URI, e.g. `mailto:you@example.com` |
| `CRON_SECRET` | **Required** bearer token to protect the cron endpoint |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically in hosted Supabase edge functions.

### 4. Apply migration

```bash
supabase db push
# or
supabase migration up
```

### 5. Deploy the edge function

```bash
supabase functions deploy send-push-reminders --no-verify-jwt
```

Use `--no-verify-jwt` because this function is invoked by cron with a service secret, not by end users. **`CRON_SECRET` is required in production** — the function rejects unauthenticated requests and returns 500 if the secret is not configured.

### 6. Schedule the cron job

Run hourly (adjust to taste). Production uses GitHub Actions (`.github/workflows/push-reminders-cron.yml`) — see [push-reminders-go-live.md](./push-reminders-go-live.md).

Manual or external scheduler example:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/send-push-reminders" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"
```

For local testing:

```bash
supabase functions serve send-push-reminders --env-file supabase/.env.local
curl -X POST "http://127.0.0.1:54321/functions/v1/send-push-reminders" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### 7. User flow

1. Install PushUS from the bottom dock when it appears. On Android this opens the native install flow. On iPhone, tap Share, then **Add to Home Screen**.
2. Open **Settings → Push reminders**.
3. Tap **Turn on** — the browser asks for notification permission.
4. Adjust active hours, reminder frequency, or enable **Injury pause** as needed.

## Operations

- **410/404 from push service:** The edge function disables the subscription and logs `subscription_disabled`.
- **Audit trail:** `notification_events` records sends, failures, and disabled subscriptions (users can read their own rows via RLS).
- **Bad subscriptions:** Re-enable push from Settings to register a fresh subscription.
- **Android reliability:** If a user stays in normal Chrome and does not install PushUS, Chrome can quieten or remove website notification permission for low-engagement sites. Ask them to install PushUS and then re-enable reminders from Settings if notifications stop.
- **iOS reliability:** iPhone users should add PushUS to the home screen before relying on push reminders. If reminders stop, open the home-screen app and check Settings → Push reminders.

## Security notes

- Never expose `VAPID_PRIVATE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in frontend code or git.
- `CRON_SECRET` must be set on hosted Supabase before enabling the push-reminders cron. Requests without a valid bearer token are rejected.
- RLS restricts `notification_preferences` and `push_subscriptions` to the owning user.
- `notification_events` inserts are service-role only.
